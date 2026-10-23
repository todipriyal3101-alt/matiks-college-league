"use server";

import { requireAdminWriter } from "@/lib/auth/admin";
import { emailEnabled, pocAnnouncementEmail, sendLater } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { pocNotificationSchema, type PocNotificationInput } from "@/lib/validation/portal";

/**
 * "Send notification": in-app to every matching POC login (send_poc_notification, admin writers only, enforced in the
 * database too), plus an email each when Resend is configured.
 */
export async function sendPocNotification(
  input: PocNotificationInput,
): Promise<{ ok: true; sent: number; emailed: boolean } | { ok: false; error: string; field?: string }> {
  await requireAdminWriter();
  const parsed = pocNotificationSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Invalid request.", field: issue?.path.join(".") };
  }
  const { title, body, scope, country, registrationId } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_poc_notification", {
    p_title: title,
    p_body: body,
    p_scope: scope,
    p_country: scope === "college" ? null : country,
    p_registration_id: scope === "college" ? registrationId : null,
  });
  if (error) {
    console.error("send_poc_notification:", error.code, error.message);
    return { ok: false, error: error.code === "42501" ? "Only admins can send notifications." : "Couldn't send. Please try again." };
  }

  const emails = [...new Set(data.map((r) => r.email.toLowerCase()))];
  if (emails.length && emailEnabled()) sendLater(async () => emails.map((to) => pocAnnouncementEmail(to, { title, body })));
  return { ok: true, sent: data.length, emailed: emailEnabled() && emails.length > 0 };
}
