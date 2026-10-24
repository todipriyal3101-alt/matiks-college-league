import "server-only";

import { Resend } from "resend";

import { siteUrl } from "@/lib/site-url";

// Emails via Resend. Server only. Since 0009 ("Confirm email" off, no invites) the only one is the optional
// college-email verification code; password resets come from Supabase Auth. Everything else is in-app.
// Without RESEND_API_KEY nothing is sent; the skip is logged, so local dev and previews work without a key.

const SITE = siteUrl;
const FROM = process.env.EMAIL_FROM ?? "Matiks College League <league@matiks.com>";

let client: Resend | null | undefined;
function resend() {
  if (client === undefined) client = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  return client;
}

export function emailEnabled() {
  return !!process.env.RESEND_API_KEY;
}

export type Email = { to: string | string[]; subject: string; html: string; text: string };

/** Sends one email. Never throws: an email failure must not fail the action that triggered it. */
export async function sendEmail(email: Email): Promise<{ ok: boolean; error?: string }> {
  const r = resend();
  if (!r) {
    console.info(`[email skipped: no RESEND_API_KEY] "${email.subject}"`);
    return { ok: false, error: "Email isn't set up (RESEND_API_KEY)." };
  }
  try {
    const { error } = await r.emails.send({ from: FROM, ...email });
    if (error) {
      console.error("sendEmail:", error.name, error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("sendEmail:", e);
    return { ok: false, error: "Couldn't send the email." };
  }
}

// ---------- Templates (dark theme, inline styles for email clients) ----------

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const C = { bg: "#1a1a1a", card: "#212121", border: "#333333", text: "#ffffff", muted: "#a2a2a2", primary: "#b1fa63", edge: "#749f45" };

function layout(opts: { preheader: string; heading: string; body: string; cta?: { label: string; href: string }; footnote?: string }) {
  const cta = opts.cta
    ? `<p style="margin:28px 0 8px"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:${C.primary};color:#000;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-decoration:none;padding:13px 22px;border-radius:10px;box-shadow:0 4px 0 ${C.edge}">${esc(opts.cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;background:${C.bg};font-family:Montserrat,Segoe UI,Helvetica,Arial,sans-serif;color:${C.text}">
<span style="display:none;max-height:0;overflow:hidden">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 4px 16px"><img src="${SITE}/brand/icon.png" width="32" height="32" alt="Matiks" style="vertical-align:middle;border-radius:8px;margin-right:10px"><span style="font-weight:800;font-size:15px;letter-spacing:1px;text-transform:uppercase;vertical-align:middle">Matiks College League</span></td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:24px;padding:28px 24px;font-size:15px;line-height:1.6">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;text-transform:uppercase;letter-spacing:.5px">${esc(opts.heading)}</h1>
${opts.body}${cta}
${opts.footnote ? `<p style="margin:20px 0 0;color:${C.muted};font-size:13px">${opts.footnote}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 4px;color:${C.muted};font-size:12px">You're getting this because your email was used for the Matiks College League. <a href="${SITE}" style="color:${C.muted}">${esc(SITE.replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table></body></html>`;
}

const p = (html: string) => `<p style="margin:0 0 12px">${html}</p>`;
const muted = (html: string) => `<span style="color:${C.muted}">${html}</span>`;

/** Verified fast lane (0008): the 6-digit code for the college email. Expires in 10 minutes. */
export function verificationCodeEmail(to: string, code: string): Email {
  return {
    to,
    subject: `${code} is your Matiks College League code`,
    html: layout({
      preheader: "Your 6-digit code. It expires in 10 minutes.",
      heading: "Verify your college email",
      body:
        p("Enter this code in the registration form to get the <strong>Verified</strong> badge (verified colleges are reviewed first):") +
        `<p style="margin:18px 0;font-family:'Space Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:${C.primary}">${esc(code)}</p>` +
        p(muted("It expires in 10 minutes. If you didn't ask for it, ignore this email.")),
    }),
    text: `Your Matiks College League code: ${code}\n\nIt expires in 10 minutes. If you didn't ask for it, ignore this email.`,
  };
}
