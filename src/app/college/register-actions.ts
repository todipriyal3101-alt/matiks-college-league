"use server";

import { createHmac, randomInt } from "node:crypto";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { getStateRivalry } from "@/lib/data/public";
import { emailEnabled, sendEmail, verificationCodeEmail } from "@/lib/email";
import { SQUAD_COOKIE } from "@/lib/invite-cookie";
import { createClient } from "@/lib/supabase/server";
import { registerDraftSchema, verifyCodeSchema, type RegisterDraft } from "@/lib/validation/portal";

// Interactive Register tab (migration 0008): claim screen, autosaved drafts, join requests and the Verified fast
// lane. Every call uses the user's own session; the database functions enforce the rules (one registration per
// user, max 3 per team, rate limits).

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const ids = z.array(z.uuid()).max(20);
const email = z.email().trim().toLowerCase().max(254);

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims.sub ?? null };
}

export type ClaimStatus = { registrationId: string; claimedBy: string; status: string };

/** Which of these colleges are claimed this season (first name + last initial only). */
export async function getClaimStatuses(collegeIds: string[]): Promise<Record<string, ClaimStatus>> {
  const parsed = ids.safeParse(collegeIds);
  if (!parsed.success || !parsed.data.length) return {};
  const { supabase, userId } = await signedIn();
  if (!userId) return {};
  const { data, error } = await supabase.rpc("college_claim_status", { p_college_ids: parsed.data });
  if (error) {
    console.error("college_claim_status:", error.message);
    return {};
  }
  return Object.fromEntries(data.map((r) => [r.college_id, { registrationId: r.registration_id, claimedBy: r.claimed_by, status: r.status }]));
}

/** "4 colleges from Odisha are in" (approved this season). */
export async function getRivalry(state: string): Promise<number> {
  const parsed = z.string().trim().min(2).max(120).safeParse(state);
  if (!parsed.success) return 0;
  return getStateRivalry(parsed.data).catch(() => 0);
}

export async function requestToJoin(registrationId: string): Promise<Result> {
  if (!z.uuid().safeParse(registrationId).success) return { ok: false, error: "Invalid request." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  const { error } = await supabase.rpc("request_to_join", { p_registration_id: registrationId });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Couldn't send the request. Try again." };
  refresh();
  return { ok: true };
}

export async function cancelJoinRequest(requestId: string): Promise<Result> {
  if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Invalid request." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  const { error } = await supabase.rpc("cancel_my_join_request", { p_request_id: requestId });
  if (error) return { ok: false, error: "Couldn't cancel. Try again." };
  refresh();
  return { ok: true };
}

/** POC panel: accept or decline someone who asked to join. */
export async function decideJoinRequest(requestId: string, accept: boolean): Promise<Result> {
  if (!z.uuid().safeParse(requestId).success || typeof accept !== "boolean") return { ok: false, error: "Invalid request." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  const { error } = await supabase.rpc("decide_join_request", { p_request_id: requestId, p_accept: accept });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Couldn't save. Try again." };
  refresh();
  return { ok: true };
}

/** Autosave (debounced by the stepper). One draft per user; resumes on any device. */
export async function saveDraft(draft: RegisterDraft): Promise<Result> {
  const parsed = registerDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "Couldn't save the draft." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  // Already registered (a late autosave racing the submit): there's nothing to draft any more.
  const { count } = await supabase.from("college_access").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  if (count) return { ok: true };
  const { error } = await supabase.from("registration_drafts").upsert({ user_id: userId, data: parsed.data });
  if (error) {
    console.error("saveDraft:", error.message);
    return { ok: false, error: "Couldn't save the draft." };
  }
  return { ok: true };
}

export async function discardDraft(): Promise<Result> {
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  await supabase.from("registration_drafts").delete().eq("user_id", userId);
  return { ok: true };
}

// ---------- Verified fast lane ----------
// The code is HMAC'd with a server-only key before it reaches the database, so a database read never reveals it.
function hashCode(address: string, code: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createHmac("sha256", key).update(`${address}:${code}`).digest("hex");
}

export async function sendVerificationCode(address: string): Promise<Result> {
  if (!emailEnabled()) return { ok: false, error: "Verification is coming soon." };
  const parsed = email.safeParse(address);
  if (!parsed.success) return { ok: false, error: "Enter a valid college email." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const { error } = await supabase.rpc("start_email_verification", { p_email: parsed.data, p_code_hash: hashCode(parsed.data, code) });
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Couldn't send a code. Try again." };
  const sent = await sendEmail(verificationCodeEmail(parsed.data, code));
  if (!sent.ok) return { ok: false, error: "Couldn't send the email. Check the address and try again." };
  return { ok: true };
}

export async function checkVerificationCode(address: string, code: string): Promise<Result<{ verified: boolean; message?: string }>> {
  const parsedEmail = email.safeParse(address);
  const parsedCode = verifyCodeSchema.safeParse(code);
  if (!parsedEmail.success) return { ok: false, error: "Enter a valid college email." };
  if (!parsedCode.success) return { ok: false, error: "Enter the 6-digit code." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in again." };
  const { data, error } = await supabase.rpc("check_email_verification", {
    p_email: parsedEmail.data,
    p_code_hash: hashCode(parsedEmail.data, parsedCode.data),
  });
  if (error) return { ok: false, error: "Couldn't check the code. Try again." };
  if (data === "ok") return { ok: true, verified: true };
  if (data === "expired") return { ok: true, verified: false, message: "That code expired. Send a new one." };
  if (data === "locked") return { ok: true, verified: false, message: "Too many tries. Send a new code." };
  const left = Number(data.split(":")[1] ?? 0);
  return { ok: true, verified: false, message: `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.` };
}

export async function isEmailVerified(address: string): Promise<boolean> {
  const parsed = email.safeParse(address);
  if (!parsed.success) return false;
  const { supabase, userId } = await signedIn();
  if (!userId) return false;
  const { data } = await supabase.rpc("my_email_verified", { p_email: parsed.data });
  return !!data;
}

// ---------- Co-lead links (/j/CODE) ----------

/** Redeems a co-lead link for the signed-in user: they get access and become a contact (max 3 per team). */
export async function joinWithSquadLink(code: string): Promise<Result> {
  const parsed = z.string().regex(/^[a-z0-9]{12}$/).safeParse(code);
  if (!parsed.success) return { ok: false, error: "This invite link has expired. Ask your Campus Lead for a new one." };
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sign in first." };
  const { error } = await supabase.rpc("redeem_squad_invite", { p_code: parsed.data });
  (await cookies()).delete(SQUAD_COOKIE);
  if (error) return { ok: false, error: error.code === "P0001" ? error.message : "Couldn't join. Try again." };
  return { ok: true };
}

/** Clears a remembered co-lead link that couldn't be used (shown once on the Register tab). */
export async function forgetSquadLink(): Promise<void> {
  (await cookies()).delete(SQUAD_COOKIE);
}
