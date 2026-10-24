"use server";

import { track } from "@vercel/analytics/server";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { ATTRIBUTION_COOKIE, parseAttributionCookie } from "@/lib/attribution";
import { getAdmin } from "@/lib/auth/admin";
import { getRegistrationsPaused } from "@/lib/data/portal";
import { registrationReceivedEmail, sendLater } from "@/lib/email";
import { INVITE_CODE_RE, INVITE_COOKIE } from "@/lib/invite-cookie";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  detailsToRow,
  pocRegisterSchema,
  profileSchema,
  registrationDetailsSchema,
  teamContactsSchema,
  type PocContactInput,
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
  const { collegeId, collegeName, country, details, contact } = parsed.data;

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

  // Name and phone also live on the account (sign-up asked for them); keep them current.
  const meta = (claims.claims.user_metadata ?? {}) as { name?: string; phone?: string };
  if (meta.name !== contact.name || meta.phone !== contact.phone) {
    const { error } = await supabase.auth.updateUser({ data: { name: contact.name, phone: contact.phone } });
    if (error) console.error("registerMyCollege updateUser:", error.message);
  }

  const cookieStore = await cookies();
  const attribution = parseAttributionCookie(cookieStore.get(ATTRIBUTION_COOKIE)?.value);
  const inviteCode = cookieStore.get(INVITE_COOKIE)?.value;
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
    p_poc_name: contact.name,
    p_poc_phone: contact.phone,
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

  // create_my_registration() made the primary contact (name, phone, login email); add the rest with the POC's own
  // session (RLS: own registration; triggers keep merch fields and the primary flag).
  const { error: contactError } = await supabase
    .from("contacts")
    .update({
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      year: contact.year,
      matiks_username: contact.matiksUsername,
      tshirt_size: contact.tshirtSize,
      address: contact.address,
      pincode: contact.pincode,
    })
    .eq("registration_id", registrationId)
    .eq("is_primary", true);
  if (contactError) console.error("registerMyCollege contact details:", contactError.message);

  // Came through someone's invite link (/i/CODE)? Credit them. Admin-only column, so the service role sets it,
  // and never the POC's own link.
  if (inviteCode && INVITE_CODE_RE.test(inviteCode)) {
    const admin = createAdminClient();
    const { data: invite } = await admin.from("invite_codes").select("code, user_id").eq("code", inviteCode).maybeSingle();
    if (invite && invite.user_id !== userId) {
      const { error: inviteError } = await admin.from("registrations").update({ invite_code: invite.code }).eq("id", registrationId);
      if (inviteError) console.error("registerMyCollege invite:", inviteError.message);
    }
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

/**
 * Team contacts (Register tab / Profile & contacts): the POC edits every contact's details and adds or removes the
 * others (max 3). Allowed while pending AND after approval: contacts aren't locked. The database still decides:
 * RLS = own registration only; triggers keep merch fields + the primary flag, cap at 3, and protect the primary.
 */
export async function saveTeamContacts(registrationId: string, input: PocContactInput[]): Promise<PortalResult> {
  if (!z.uuid().safeParse(registrationId).success) return { ok: false, error: "Invalid request." };
  const parsed = teamContactsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  const supabase = await createClient();
  const { data: current, error } = await supabase
    .from("contacts")
    .select("id, is_primary, name, phone, email, year, matiks_username, tshirt_size, address, pincode")
    .eq("registration_id", registrationId);
  if (error) return { ok: false, error: "Couldn't load your contacts." };
  if (!current.length) return { ok: false, error: "You don't have access to this college." };

  const row = (c: (typeof parsed.data)[number]) => ({
    name: c.name,
    phone: c.phone,
    email: c.email,
    year: c.year,
    matiks_username: c.matiksUsername,
    tshirt_size: c.tshirtSize,
    address: c.address,
    pincode: c.pincode,
  });
  const keep = new Set(parsed.data.flatMap((c) => (c.id ? [c.id] : [])));
  const primary = current.find((c) => c.is_primary);
  if (primary && !keep.has(primary.id)) return { ok: false, error: "The primary contact can't be removed." };

  for (const c of current.filter((c) => !keep.has(c.id))) {
    const { error: e } = await supabase.from("contacts").delete().eq("id", c.id).eq("registration_id", registrationId);
    if (e) return { ok: false, error: e.message };
  }
  for (const c of parsed.data) {
    const existing = c.id ? current.find((x) => x.id === c.id) : undefined;
    if (c.id && !existing) return { ok: false, error: "That contact no longer exists. Reload the page." };
    const next = row(c);
    if (existing) {
      const changed = Object.entries(next).some(([k, v]) => (existing[k as keyof typeof existing] ?? null) !== (v ?? null));
      if (!changed) continue;
      const { error: e } = await supabase.from("contacts").update(next).eq("id", existing.id).eq("registration_id", registrationId);
      if (e) return { ok: false, error: e.message };
    } else {
      const { error: e } = await supabase.from("contacts").insert({ ...next, registration_id: registrationId, role: "poc" });
      if (e) return { ok: false, error: e.code === "23514" ? e.message : "Couldn't add the contact." };
    }
  }
  refresh();
  return { ok: true };
}
