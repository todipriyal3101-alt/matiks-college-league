"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { getAdmin } from "@/lib/auth/admin";
import { fetchRegistrationDetail, type RegistrationDetail } from "@/lib/data/league-ops";
import type { TablesInsert, TablesUpdate } from "@/lib/database.types";
import { sendLater, winnerPaidEmail } from "@/lib/email";
import { formatINR } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { detailsToRow } from "@/lib/validation/portal";
import {
  adminEditorSchema,
  editorSchema,
  markPaidSchema,
  type AdminEditorData,
  type EditorData,
} from "@/lib/validation/league-ops";

// CollegeEditor actions, shared by admin mode (/admin/colleges/[id]) and POC mode (/college).
// Every write uses the caller's own session: RLS + triggers (migration 0003) enforce what POCs may change
// (team name, contacts, unpaid winner details) and log admin changes. These checks are a second layer.

export type EditorMode = "admin" | "poc";
export type EditorResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const id = z.uuid();

/** Admin mode needs an admin writer; POC mode needs POC access to this registration. */
async function authorize(registrationId: string, mode: EditorMode): Promise<string | null> {
  if (!id.safeParse(registrationId).success) return "Invalid request.";
  if (mode === "admin") {
    const admin = await getAdmin();
    return admin?.isWriter ? null : "Only admins can make changes.";
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_registration_poc", { reg_id: registrationId });
  return !error && data ? null : "You don't have access to this college.";
}

async function requireAdminWriterResult(): Promise<string | null> {
  const admin = await getAdmin();
  return admin?.isWriter ? null : "Only admins can make changes.";
}

function friendly(error: { code?: string; message: string }) {
  // Messages raised by our triggers are written for people; pass them through.
  if (error.code === "42501" || error.code === "23514") return error.message;
  if (error.code === "23505") return "Only one primary contact is allowed.";
  console.error("editor:", error.code, error.message);
  return "Couldn't save. Please try again.";
}

const contactRow = (c: EditorData["contacts"][number]) => ({
  name: c.name,
  email: c.email,
  phone: c.phone,
  year: c.year,
  course: c.course,
  matiks_username: c.matiksUsername,
  tshirt_size: c.tshirtSize,
  address: c.address,
  pincode: c.pincode,
});

const winnerRow = (w: EditorData["winners"][number]) => ({
  position: w.position,
  name: w.name,
  email: w.email,
  phone: w.phone,
  matiks_username: w.matiksUsername,
  upi_id: w.upiId,
  tshirt_size: w.tshirtSize,
  address: w.address,
  pincode: w.pincode,
});

/** Only the keys whose value differs, so unchanged rows aren't written (no noise in updated_at). */
function changed<T extends Record<string, unknown>>(next: T, current: Record<string, unknown>): Partial<T> {
  return Object.fromEntries(Object.entries(next).filter(([k, v]) => (current[k] ?? null) !== (v ?? null))) as Partial<T>;
}

/**
 * Saves the editor form: registration fields, then contacts and winners (delete removed → update → insert).
 * Returns the fresh detail so the form picks up ids of newly added rows.
 */
export async function saveEditor(
  registrationId: string,
  mode: EditorMode,
  input: unknown,
): Promise<EditorResult<{ detail: RegistrationDetail }>> {
  const denied = await authorize(registrationId, mode);
  if (denied) return { ok: false, error: denied };

  const parsed = (mode === "admin" ? adminEditorSchema : editorSchema).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Some details are invalid." };
  const data = parsed.data as EditorData & Partial<AdminEditorData>;

  const current = await fetchRegistrationDetail(registrationId);
  if (!current) return { ok: false, error: "College not found." };
  const supabase = await createClient();

  // Registration
  const registrationPatch = changed(
    {
      team_name: data.teamName,
      ...(mode === "admin"
        ? { participant_count: data.participantCount, prize_pool_override: data.prizePoolOverride, ...detailsToRow(data.details!) }
        : {}),
    } as TablesUpdate<"registrations">,
    current.registration,
  );
  if (Object.keys(registrationPatch).length) {
    const { error } = await supabase.from("registrations").update(registrationPatch).eq("id", registrationId);
    if (error) return { ok: false, error: friendly(error) };
  }
  // Country lives on the college (the master record); admin only.
  if (mode === "admin" && data.details && data.details.country !== current.registration.colleges.country) {
    const { error } = await supabase.from("colleges").update({ country: data.details.country }).eq("id", current.registration.college_id);
    if (error) return { ok: false, error: friendly(error) };
  }

  // Contacts
  const keepContacts = new Set(data.contacts.flatMap((c) => (c.id ? [c.id] : [])));
  for (const c of current.contacts.filter((c) => !keepContacts.has(c.id))) {
    const { error } = await supabase.from("contacts").delete().eq("id", c.id).eq("registration_id", registrationId);
    if (error) return { ok: false, error: friendly(error) };
  }
  for (const c of data.contacts) {
    const row = {
      ...contactRow(c),
      ...(mode === "admin" ? { merch_description: (c as AdminEditorData["contacts"][number]).merchDescription } : {}),
    };
    const existing = current.contacts.find((x) => x.id === c.id);
    if (existing) {
      const patch = changed(row, existing);
      if (!Object.keys(patch).length) continue;
      const { error } = await supabase.from("contacts").update(patch).eq("id", existing.id).eq("registration_id", registrationId);
      if (error) return { ok: false, error: friendly(error) };
    } else {
      const { error } = await supabase
        .from("contacts")
        .insert({ ...row, registration_id: registrationId } satisfies TablesInsert<"contacts">);
      if (error) return { ok: false, error: friendly(error) };
    }
  }

  // Winners
  const keepWinners = new Set(data.winners.flatMap((w) => (w.id ? [w.id] : [])));
  for (const w of current.winners.filter((w) => !keepWinners.has(w.id))) {
    const { data: deleted, error } = await supabase
      .from("winners")
      .delete()
      .eq("id", w.id)
      .eq("registration_id", registrationId)
      .select("id");
    if (error) return { ok: false, error: friendly(error) };
    if (!deleted.length) return { ok: false, error: `${w.position} place has been paid and can't be removed.` };
  }
  for (const w of data.winners) {
    const admin = w as AdminEditorData["winners"][number];
    const row = {
      ...winnerRow(w),
      ...(mode === "admin"
        ? { prize_type: admin.prizeType, prize_amount: admin.prizeAmount, merch_description: admin.merchDescription }
        : {}),
    };
    const existing = current.winners.find((x) => x.id === w.id);
    if (existing) {
      const patch = changed(row, existing);
      if (!Object.keys(patch).length) continue;
      const { error } = await supabase.from("winners").update(patch).eq("id", existing.id).eq("registration_id", registrationId);
      if (error) return { ok: false, error: friendly(error) };
    } else {
      const { error } = await supabase
        .from("winners")
        .insert({ ...row, registration_id: registrationId } satisfies TablesInsert<"winners">);
      if (error) return { ok: false, error: friendly(error) };
    }
  }

  // No refresh(): re-rendering the whole page kept the save "pending" for seconds and blocked the next save.
  // The editor applies this fresh detail itself.
  const detail = await fetchRegistrationDetail(registrationId);
  if (!detail) return { ok: false, error: "College not found." };
  return { ok: true, detail };
}

// ---------- Admin toggles (immediate, with Undo) ----------

type WinnerPayment = { status: "pending" | "paid"; reference: string | null };

/** Mark a winner paid with the UTR. Returns the previous payment state for Undo. */
export async function markWinnerPaid(input: { winnerId: string; utr: string }): Promise<EditorResult<{ previous: WinnerPayment }>> {
  const denied = await requireAdminWriterResult();
  if (denied) return { ok: false, error: denied };
  const parsed = markPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid UTR." };
  return setWinnerPayment(parsed.data.winnerId, { status: "paid", reference: parsed.data.utr });
}

/** Mark a winner unpaid (or restore a previous payment state on Undo). */
export async function restoreWinnerPayment(winnerId: string, payment: WinnerPayment): Promise<EditorResult<{ previous: WinnerPayment }>> {
  const denied = await requireAdminWriterResult();
  if (denied) return { ok: false, error: denied };
  const parsed = z
    .object({ winnerId: id, status: z.enum(["pending", "paid"]), reference: z.string().max(30).nullable() })
    .safeParse({ winnerId, ...payment });
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  return setWinnerPayment(parsed.data.winnerId, { status: parsed.data.status, reference: parsed.data.reference });
}

async function setWinnerPayment(winnerId: string, next: WinnerPayment): Promise<EditorResult<{ previous: WinnerPayment }>> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("winners").select("payment_status, payment_reference").eq("id", winnerId).maybeSingle();
  if (!before) return { ok: false, error: "Winner not found." };
  const { error } = await supabase
    .from("winners")
    .update({ payment_status: next.status, payment_reference: next.reference })
    .eq("id", winnerId);
  if (error) return { ok: false, error: friendly(error) };
  if (next.status === "paid" && next.reference) emailWinnerPaid(winnerId, next.reference);
  refresh();
  return { ok: true, previous: { status: before.payment_status, reference: before.payment_reference } };
}

/** "Prize paid" to the winner (and the college POC), after the Undo window and only if still paid with this UTR. */
function emailWinnerPaid(winnerId: string, utr: string) {
  sendLater(
    async () => {
      const { data: w } = await createAdminClient()
        .from("winners")
        .select("name, email, position, prize_type, prize_amount, payment_status, payment_reference, registrations(poc_email, colleges(name), leagues(name))")
        .eq("id", winnerId)
        .maybeSingle();
      if (!w || w.payment_status !== "paid" || w.payment_reference !== utr) return null;
      const to = [...new Set([w.email, w.registrations.poc_email].filter((e): e is string => !!e).map((e) => e.toLowerCase()))];
      if (!to.length) return null;
      return winnerPaidEmail(to, {
        winnerName: w.name ?? "there",
        position: w.position,
        collegeName: w.registrations.colleges.name,
        leagueName: w.registrations.leagues.name,
        amount: w.prize_type === "merch_only" ? null : formatINR(w.prize_amount),
        utr,
      });
    },
    { afterUndoWindow: true },
  );
}

/** Merch sent switch on a winner or a contact. */
export async function setMerchSent(
  target: "winner" | "contact",
  rowId: string,
  sent: boolean,
): Promise<EditorResult> {
  const denied = await requireAdminWriterResult();
  if (denied) return { ok: false, error: denied };
  if (!id.safeParse(rowId).success || typeof sent !== "boolean") return { ok: false, error: "Invalid request." };
  const supabase = await createClient();
  const { error } =
    target === "winner"
      ? await supabase.from("winners").update({ merch_sent: sent }).eq("id", rowId)
      : await supabase.from("contacts").update({ merch_sent: sent }).eq("id", rowId);
  if (error) return { ok: false, error: friendly(error) };
  refresh();
  return { ok: true };
}
