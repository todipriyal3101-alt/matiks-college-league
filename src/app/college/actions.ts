"use server";

import { track } from "@vercel/analytics/server";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { ATTRIBUTION_COOKIE, parseAttributionCookie } from "@/lib/attribution";
import { getAdmin } from "@/lib/auth/admin";
import { getRegistrationsPaused } from "@/lib/data/portal";
import { registrationReceivedEmail, sendLater } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import {
  detailsToRow,
  pocRegisterSchema,
  profileSchema,
  registrationDetailsSchema,
  type PocRegisterInput,
  type ProfileInput,
  type RegistrationDetailsInput,
} from "@/lib/validation/portal";

// POC portal actions (migration 0005). Every write uses the POC's own session: create_my_registration() and RLS +
// the protect trigger decide what they may do (one pending registration; details only while pending or denied).

export type PortalResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; field?: string };

function firstIssue(error: z.ZodError): { ok: false; error: string; field: string } {
  const issue = error.issues[0];
  return { ok: false, error: issue?.message ?? "Check the form.", field: issue?.path.join(".") ?? "" };
}

/** Logos must be in the user's own folder (before registering) or this registration's folder (editing). */
function ownLogo(url: string | null, prefixes: string[]) {
  return !url || prefixes.some((p) => url.includes(`/storage/v1/object/public/logos/${p}/`));
}

/** Register tab: creates the user's one pending registration in the active season. */
export async function registerMyCollege(input: PocRegisterInput): Promise<PortalResult<{ registrationId: string }>> {
  const parsed = pocRegisterSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { collegeId, collegeName, country, details, profile } = parsed.data;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { ok: false, error: "Sign in again." };
  if (await getAdmin()) return { ok: false, error: "Matiks admins can't register a college. Use Add college in the admin panel." };
  if (!ownLogo(details.collegeLogoUrl, [`users/${userId}`]) || !ownLogo(details.clubLogoUrl, [`users/${userId}`])) {
    return { ok: false, error: "Upload the logos again.", field: "details.collegeLogoUrl" };
  }

  // Always open (migration 0006): the season's switch and deadline don't apply; only the admin's emergency pause.
  // The database checks it too; reading it here (uncached) gives the friendly message first.
  if (await getRegistrationsPaused()) return { ok: false, error: "New registrations are paused. Message us in the Chat tab." };

  // Name and phone live on the account (sign-up asked for them); keep them current.
  const meta = (claims.claims.user_metadata ?? {}) as { name?: string; phone?: string };
  if (meta.name !== profile.name || meta.phone !== profile.phone) {
    const { error } = await supabase.auth.updateUser({ data: { name: profile.name, phone: profile.phone } });
    if (error) console.error("registerMyCollege updateUser:", error.message);
  }

  const attribution = parseAttributionCookie((await cookies()).get(ATTRIBUTION_COOKIE)?.value);
  const { data: registrationId, error } = await supabase.rpc("create_my_registration", {
    p_college_id: collegeId,
    p_college_name: collegeId ? null : collegeName,
    p_country: country,
    p_college_email: details.collegeEmail,
    p_email_domain: details.emailDomain,
    p_college_logo_url: details.collegeLogoUrl,
    p_club_name: details.clubName,
    p_club_logo_url: details.clubLogoUrl,
    p_registration_start: details.registrationStart,
    p_league_start: details.leagueStart,
    p_league_end: details.leagueEnd,
    p_poc_name: profile.name,
    p_poc_phone: profile.phone,
    p_utm_source: attribution.utm_source ?? null,
    p_utm_medium: attribution.utm_medium ?? null,
    p_utm_campaign: attribution.utm_campaign ?? null,
    p_utm_content: attribution.utm_content ?? null,
    p_referral_code: attribution.ref ?? null,
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This college is already registered for this season. Message us in Chat if that's wrong.", field: "collegeName" };
    }
    if (error.code === "P0001") return { ok: false, error: error.message };
    if (error.code === "23514") return { ok: false, error: "Check the dates and the email domain." };
    console.error("create_my_registration:", error.code, error.message);
    return { ok: false, error: "Couldn't register. Please try again." };
  }

  const email = claims.claims.email;
  const name = collegeName;
  if (email) {
    sendLater(async () => {
      // The season was picked by the database (current season, created if needed).
      const { data } = await supabase.from("registrations").select("colleges(name), leagues(name)").eq("id", registrationId).maybeSingle();
      return registrationReceivedEmail(email, { collegeName: data?.colleges.name ?? name, leagueName: data?.leagues.name ?? "", registrationId });
    });
  }
  await track("college_registered", { source: attribution.utm_source ?? "direct", country, ...(attribution.ref ? { ref: attribution.ref } : {}) }).catch(() => {});
  refresh();
  return { ok: true, registrationId };
}

/** Register tab, while pending or denied: edit the details (the database refuses after approval). */
export async function updateMyRegistration(registrationId: string, input: RegistrationDetailsInput): Promise<PortalResult> {
  if (!z.uuid().safeParse(registrationId).success) return { ok: false, error: "Invalid request." };
  const parsed = registrationDetailsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return { ok: false, error: "Sign in again." };
  const folders = [`users/${userId}`, `registrations/${registrationId}`];
  if (!ownLogo(parsed.data.collegeLogoUrl, folders) || !ownLogo(parsed.data.clubLogoUrl, folders)) {
    return { ok: false, error: "Upload the logos again." };
  }

  const { data: current } = await supabase.from("registrations").select("status").eq("id", registrationId).maybeSingle();
  if (!current) return { ok: false, error: "College not found." };
  if (current.status !== "pending" && current.status !== "rejected") {
    return { ok: false, error: "Your college is approved, so these details are locked. Message us in Chat to change them." };
  }

  const { error } = await supabase.from("registrations").update(detailsToRow(parsed.data)).eq("id", registrationId);
  if (error) {
    console.error("updateMyRegistration:", error.code, error.message);
    return { ok: false, error: error.code === "23514" ? "Check the dates and the email domain." : "Couldn't save. Please try again." };
  }
  refresh();
  return { ok: true };
}

/** After a denial: send the (fixed) registration back for review. */
export async function resubmitMyRegistration(registrationId: string): Promise<PortalResult> {
  if (!z.uuid().safeParse(registrationId).success) return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_my_registration", { p_registration_id: registrationId });
  if (error) return { ok: false, error: error.code === "P0001" || error.code === "42501" ? error.message : "Couldn't resubmit. Please try again." };
  refresh();
  return { ok: true };
}

/** Profile: the POC's own name and phone (account metadata). Contacts are edited separately. */
export async function updateMyProfile(input: ProfileInput): Promise<PortalResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { name: parsed.data.name, phone: parsed.data.phone } });
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}
