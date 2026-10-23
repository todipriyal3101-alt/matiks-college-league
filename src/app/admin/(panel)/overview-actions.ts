"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";

import { requireAdminWriter, type AdminProfile } from "@/lib/auth/admin";
import { emailAccessGranted, findOrInviteUser, grantPocAccess } from "@/lib/auth/invite";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { sendLater, statusChangedEmail } from "@/lib/email";
import { REVIEW_STATUSES, STAGES, type ReviewStatus, type Stage } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { addCollegeSchema, type AddCollegeInput } from "@/lib/validation/league-ops";
import { denySchema, detailsToRow } from "@/lib/validation/portal";

// League Overview actions. Writes use the admin's own session (RLS + activity log record who did it);
// only register_college needs the service role.

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** What Undo puts back: review status, the deny reason and the stage override (null = derived from the dates). */
type Previous = { id: string; status: ReviewStatus; stage_override: Stage | null; deny_reason: string | null }[];

const ids = z.array(z.uuid()).min(1).max(500);

async function snapshot(registrationIds: string[]): Promise<Previous> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("id, status, stage_override, deny_reason")
    .in("id", registrationIds);
  if (error) throw new Error(error.message);
  return data;
}

/** Approve / Waitlist / Reject one or many. Returns the previous values for Undo. */
export async function setReviewStatus(
  registrationIds: string[],
  status: ReviewStatus,
): Promise<ActionResult<{ previous: Previous }>> {
  const { profile } = await requireAdminWriter();
  const parsed = z.object({ ids, status: z.enum(REVIEW_STATUSES) }).safeParse({ ids: registrationIds, status });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const previous = await snapshot(parsed.data.ids);
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({
      status: parsed.data.status,
      reviewed_by: profile.user_id,
      reviewed_at: new Date().toISOString(),
      ...(parsed.data.status === "rejected" ? {} : { deny_reason: null }),
    })
    .in("id", parsed.data.ids);
  if (error) return { ok: false, error: error.message };
  updateTag(CACHE_TAGS.colleges);
  emailStatusChange(parsed.data.ids, parsed.data.status);
  refresh();
  return { ok: true, previous };
}

/** Deny with an optional reason (shown to the POC on their Register tab, in the notification and the email). */
export async function denyRegistration(registrationId: string, reason: string | null): Promise<ActionResult<{ previous: Previous }>> {
  const { profile } = await requireAdminWriter();
  const parsed = denySchema.safeParse({ registrationId, reason: reason ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const previous = await snapshot([parsed.data.registrationId]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("registrations")
    .update({ status: "rejected", deny_reason: parsed.data.reason, reviewed_by: profile.user_id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.registrationId);
  if (error) return { ok: false, error: error.message };
  updateTag(CACHE_TAGS.colleges);
  emailStatusChange([parsed.data.registrationId], "rejected");
  refresh();
  return { ok: true, previous };
}

/** Tells each POC about the new review status, once the Undo window has passed and only if it still holds. */
function emailStatusChange(registrationIds: string[], status: ReviewStatus) {
  if (status === "pending") return;
  sendLater(
    async () => {
      const { data } = await createAdminClient()
        .from("registrations")
        .select("poc_email, deny_reason, colleges(name), leagues(name)")
        .in("id", registrationIds)
        .eq("status", status);
      return (data ?? []).map((r) =>
        statusChangedEmail(r.poc_email, { collegeName: r.colleges.name, leagueName: r.leagues.name, status, reason: r.deny_reason }),
      );
    },
    { afterUndoWindow: true },
  );
}

/**
 * Override the stage of one or many (null = back to automatic: derived from the dates and payouts).
 * Returns the previous values for Undo.
 */
export async function setStage(registrationIds: string[], stage: Stage | null): Promise<ActionResult<{ previous: Previous }>> {
  await requireAdminWriter();
  const parsed = z.object({ ids, stage: z.enum(STAGES).nullable() }).safeParse({ ids: registrationIds, stage });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const previous = await snapshot(parsed.data.ids);
  const supabase = await createClient();
  const { error } = await supabase.from("registrations").update({ stage_override: parsed.data.stage }).in("id", parsed.data.ids);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, previous };
}

/** Undo for setReviewStatus / denyRegistration / setStage: puts back the previous status, reason and stage override. */
export async function restoreRegistrations(previous: Previous): Promise<ActionResult> {
  await requireAdminWriter();
  const parsed = z
    .array(
      z.object({
        id: z.uuid(),
        status: z.enum(REVIEW_STATUSES),
        stage_override: z.enum(STAGES).nullable(),
        deny_reason: z.string().max(500).nullable(),
      }),
    )
    .min(1)
    .max(500)
    .safeParse(previous);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  // Group identical values so a bulk undo is a handful of updates, not one per row.
  const groups = Map.groupBy(parsed.data, (p) => JSON.stringify([p.status, p.stage_override, p.deny_reason]));
  for (const rows of groups.values()) {
    const { status, stage_override, deny_reason } = rows[0];
    const { error } = await supabase
      .from("registrations")
      .update({ status, stage_override, deny_reason })
      .in("id", rows.map((r) => r.id));
    if (error) return { ok: false, error: error.message };
  }
  updateTag(CACHE_TAGS.colleges);
  refresh();
  return { ok: true };
}

/** Delete one registration (this season only; the college master record stays). Name must be typed to confirm. */
export async function deleteRegistration(registrationId: string, typedName: string): Promise<ActionResult> {
  await requireAdminWriter();
  const parsed = z.object({ id: z.uuid(), typedName: z.string().trim().min(1) }).safeParse({ id: registrationId, typedName });
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const supabase = await createClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("id, colleges(name)")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!registration) return { ok: false, error: "Registration not found." };
  if (registration.colleges.name.trim().toLowerCase() !== parsed.data.typedName.toLowerCase()) {
    return { ok: false, error: "The name you typed doesn't match the college." };
  }

  const { error } = await supabase.from("registrations").delete().eq("id", parsed.data.id);
  if (error) return { ok: false, error: error.message };
  updateTag(CACHE_TAGS.colleges);
  refresh();
  return { ok: true };
}

/** "Add college": registers a college for this season (approved) with its primary POC. */
export async function addCollege(
  input: AddCollegeInput,
): Promise<ActionResult<{ registrationId: string; message: string }> & { field?: string }> {
  const { profile } = await requireAdminWriter();
  const parsed = addCollegeSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid request.", field: issue?.path.join(".") };
  }
  const { leagueId, collegeId, newCollege, poc, details } = parsed.data;

  // register_college is EXECUTE-able by the service role only (migration 0002).
  const { data: registrationId, error } = await createAdminClient().rpc("register_college", {
    p_league_id: leagueId,
    p_poc: { name: poc.name, email: poc.email, phone: poc.phone },
    ...(collegeId
      ? { p_college_id: collegeId }
      : {
          p_college_name: newCollege!.name,
          p_college_city: newCollege!.city,
          p_college_state: newCollege!.state,
          p_college_type: "other",
        }),
  });
  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "This college is already registered for this season.", field: "collegeId" };
    }
    console.error("addCollege:", error.code, error.message);
    return { ok: false, error: "Couldn't add the college. Please try again." };
  }

  // Approve (+ the league details) with the admin's own session so the activity log records who did it.
  const supabase = await createClient();
  const { data: added, error: approveError } = await supabase
    .from("registrations")
    .update({
      status: "approved",
      reviewed_by: profile.user_id,
      reviewed_at: new Date().toISOString(),
      ...detailsToRow(details),
    })
    .eq("id", registrationId)
    .select("college_id")
    .single();
  if (approveError) return { ok: false, error: `Added, but saving failed: ${approveError.message}` };
  // Country lives on the college (the master record).
  const { error: countryError } = await supabase.from("colleges").update({ country: details.country }).eq("id", added.college_id);
  if (countryError) return { ok: false, error: `Added, but setting the country failed: ${countryError.message}` };
  updateTag(CACHE_TAGS.colleges);

  let message = "";
  if (parsed.data.invitePoc) {
    const invited = await inviteOne(profile, registrationId, { approve: false });
    message = invited.ok ? invited.message : `The invite failed: ${invited.error}`;
  }
  refresh();
  return { ok: true, registrationId, message };
}

/** "Invite POC" / "Approve + invite POC": gives the registration's POC (or another email) a login for this college. */
export async function invitePoc(
  registrationId: string,
  options: { approve: boolean; email?: string },
): Promise<ActionResult<{ message: string }>> {
  const { profile } = await requireAdminWriter();
  const res = await inviteOne(profile, registrationId, options);
  refresh();
  return res;
}

async function inviteOne(
  profile: AdminProfile,
  registrationId: string,
  options: { approve: boolean; email?: string },
): Promise<ActionResult<{ message: string }>> {
  const parsed = z
    .object({ id: z.uuid(), approve: z.boolean(), email: z.email("Enter a valid email").trim().toLowerCase().optional() })
    .safeParse({ id: registrationId, ...options, email: options.email || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const supabase = await createClient();
  const { data: registration } = await supabase
    .from("registrations")
    .select("poc_email, status, colleges(name)")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!registration) return { ok: false, error: "Registration not found." };
  const email = parsed.data.email ?? registration.poc_email.toLowerCase();
  const who = registration.colleges.name;

  if (parsed.data.approve && registration.status !== "approved") {
    const { error } = await supabase
      .from("registrations")
      .update({ status: "approved", reviewed_by: profile.user_id, reviewed_at: new Date().toISOString() })
      .eq("id", parsed.data.id);
    if (error) return { ok: false, error: `${who}: ${error.message}` };
    updateTag(CACHE_TAGS.colleges);
  }

  const context = { collegeName: who, approved: parsed.data.approve };
  const user = await findOrInviteUser(email, "poc", context);
  if (!user.ok) return { ok: false, error: `${who}: ${user.error}` };
  const granted = await grantPocAccess(user.userId, parsed.data.id, profile.user_id);
  if (!granted.ok) return { ok: false, error: `${who}: ${granted.error}` };
  const emailed = !user.invited && (await emailAccessGranted(email, "poc", context));

  const prefix = parsed.data.approve ? "Approved · " : "";
  return {
    ok: true,
    message: `${prefix}${user.invited ? `invite sent to ${email}` : `${email} has access${emailed ? " (emailed)" : ""}`}`,
  };
}
