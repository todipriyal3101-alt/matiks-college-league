"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { ATTRIBUTION_COOKIE, parseAttributionCookie } from "@/lib/attribution";
import { getActiveLeagueFresh, isRegistrationOpen } from "@/lib/data/leagues";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstile } from "@/lib/turnstile";
import {
  normalizeCollegeName,
  registrationSchema,
  type RegistrationResult,
} from "@/lib/validation/registration";

const UNIQUE_VIOLATION = "23505";

export async function submitRegistration(input: unknown): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: "Some details are missing or invalid. Please check the form." };
  }
  const { college, poc, team, review } = parsed.data;

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (!(await verifyTurnstile(review.turnstileToken, ip))) {
    return { status: "error", message: "Captcha check failed. Please try again." };
  }

  // Never the cached getActiveLeague(): registration_open and the deadline must be current.
  const league = await getActiveLeagueFresh();
  if (!league || !isRegistrationOpen(league)) return { status: "closed" };

  const attribution = parseAttributionCookie((await cookies()).get(ATTRIBUTION_COOKIE)?.value);

  const supabase = createAdminClient();
  const { data: registrationId, error } = await supabase.rpc("register_college", {
    p_league_id: league.id,
    p_poc: {
      name: poc.name,
      email: poc.email,
      phone: poc.phone,
      year: poc.year,
      course: poc.course,
      matiks_username: poc.matiksUsername,
    },
    p_participants: team.teammates.map((t) => ({
      name: t.name,
      email: t.email,
      matiks_username: t.matiksUsername,
    })),
    ...(college.notListed
      ? {
          p_college_name: college.newCollege.name,
          p_college_city: college.newCollege.city,
          p_college_state: college.newCollege.state,
          p_college_type: college.newCollege.type,
        }
      : { p_college_id: college.collegeId! }),
    p_team_name: team.teamName || undefined,
    p_utm_source: attribution.utm_source,
    p_utm_medium: attribution.utm_medium,
    p_utm_campaign: attribution.utm_campaign,
    p_utm_content: attribution.utm_content,
    p_referral_code: attribution.ref,
  });

  if (error) {
    // Unique violation on registrations (league, college) or colleges (normalized_name):
    // someone already registered this college, possibly a moment ago.
    if (error.code === UNIQUE_VIOLATION) {
      const existing = await findExistingRegistration(
        league.id,
        college.notListed
          ? { normalizedName: normalizeCollegeName(college.newCollege.name) }
          : { collegeId: college.collegeId! },
      );
      if (existing) return existing;
      return {
        status: "error",
        message: "Someone is registering this college right now. Please try again in a minute.",
      };
    }
    console.error("submitRegistration:", error);
    return { status: "error", message: "Something went wrong. Please try again." };
  }

  redirect(`/register/success?id=${registrationId}`);
}

/** The existing registration for this college + league, exposing only the POC's first name. */
async function findExistingRegistration(
  leagueId: string,
  college: { collegeId: string } | { normalizedName: string },
): Promise<RegistrationResult | null> {
  const supabase = createAdminClient();

  const collegeQuery = supabase.from("colleges").select("id, name");
  const { data: collegeRow } = await ("collegeId" in college
    ? collegeQuery.eq("id", college.collegeId)
    : collegeQuery.eq("normalized_name", college.normalizedName)
  ).maybeSingle();
  if (!collegeRow) return null;

  const { data: registration } = await supabase
    .from("registrations")
    .select("id, contacts(name, role)")
    .eq("league_id", leagueId)
    .eq("college_id", collegeRow.id)
    .maybeSingle();
  if (!registration) return null;

  const pocName = registration.contacts.find((c) => c.role === "poc")?.name;
  return {
    status: "already_registered",
    collegeName: collegeRow.name,
    pocFirstName: pocName?.trim().split(/\s+/)[0] ?? null,
  };
}
