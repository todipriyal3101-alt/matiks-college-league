import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Rate limits backed by rows that already exist (no extra store): Supabase Auth limits login, magic-link and
// reset emails itself (Dashboard > Authentication > Rate Limits); admin invite actions are admin-only.

export const REGISTRATIONS_PER_HOUR = 5;

/**
 * At most 5 registrations per POC email and per POC phone per hour (PROMPTS "Before launch").
 * Counts POC contacts created in the last hour. Fails open on a read error: Turnstile still guards the form.
 */
export async function registrationLimitReached(email: string, phone: string): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const supabase = createAdminClient();
  const recent = (column: "email" | "phone", value: string) =>
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("role", "poc")
      .eq(column, value)
      .gte("created_at", since);
  const [byEmail, byPhone] = await Promise.all([recent("email", email), recent("phone", phone)]);
  if (byEmail.error || byPhone.error) {
    console.error("registrationLimitReached:", (byEmail.error ?? byPhone.error)!.message);
    return false;
  }
  return (byEmail.count ?? 0) >= REGISTRATIONS_PER_HOUR || (byPhone.count ?? 0) >= REGISTRATIONS_PER_HOUR;
}
