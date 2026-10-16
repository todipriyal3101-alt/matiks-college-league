import "server-only";

import { after } from "next/server";
import { Resend } from "resend";

import { brandedSeason } from "@/lib/league";
import { siteUrl } from "@/lib/site-url";

// Transactional emails via Resend (PROMPTS Phase 12). Server only.
// Without RESEND_API_KEY nothing is sent; the skip is logged, so local dev and previews work without a key.

const SITE = siteUrl;
const FROM = process.env.EMAIL_FROM ?? "Matiks College League <league@matiks.com>";

/** Undo toasts stay up a few seconds; emails about an undoable change wait this long and re-check first. */
const UNDO_WINDOW_MS = 15_000;

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

/**
 * Sends after the response. With `afterUndoWindow`, waits until Undo is no longer offered first; `build` runs after
 * the wait and must re-read the data, returning nothing if the change was undone.
 */
export function sendLater(build: () => Promise<Email | Email[] | null>, options: { afterUndoWindow?: boolean } = {}) {
  after(async () => {
    if (options.afterUndoWindow) await new Promise((r) => setTimeout(r, UNDO_WINDOW_MS));
    try {
      const built = await build();
      for (const email of [built ?? []].flat()) await sendEmail(email);
    } catch (e) {
      console.error("sendLater:", e);
    }
  });
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
const mono = (s: string) => `<span style="font-family:'Space Mono',Menlo,monospace">${esc(s)}</span>`;

export function registrationReceivedEmail(to: string, d: { collegeName: string; leagueName: string; registrationId: string }): Email {
  return {
    to,
    subject: `We've got ${d.collegeName}'s registration for ${brandedSeason(d.leagueName)}`,
    html: layout({
      preheader: "What happens next with your registration.",
      heading: "Registration received 🎉",
      body:
        p(`Thanks for registering <strong>${esc(d.collegeName)}</strong> for ${esc(brandedSeason(d.leagueName))}.`) +
        p(`Our team reviews every registration. <strong>You'll get an email invite once your college is approved</strong>; it lets you sign in to your college portal and add your team's contacts and, later, your winners.`) +
        p(`${muted("Registration ID")}<br>${mono(d.registrationId)}`),
      cta: { label: "See the colleges in the league", href: `${SITE}/colleges` },
    }),
    text: `Thanks for registering ${d.collegeName} for ${brandedSeason(d.leagueName)}.\n\nOur team reviews every registration. You'll get an email invite once your college is approved.\n\nRegistration ID: ${d.registrationId}\n\n${SITE}/colleges`,
  };
}

const STATUS_COPY = {
  approved: {
    subject: (c: string) => `${c} is approved for the league`,
    heading: "You're approved ✅",
    line: "Your college is approved. We'll email you an invite to your college portal shortly.",
  },
  waitlisted: {
    subject: (c: string) => `${c} is on the waitlist`,
    heading: "You're on the waitlist",
    line: "Your college is on the waitlist. If a spot opens up, we'll approve you and email you an invite to your college portal.",
  },
  rejected: {
    subject: (c: string) => `Update on ${c}'s registration`,
    heading: "Registration update",
    line: "We couldn't confirm your college for this season. Reply to this email if you think that's a mistake.",
  },
} as const;

export function statusChangedEmail(to: string, d: { collegeName: string; leagueName: string; status: keyof typeof STATUS_COPY }): Email {
  const copy = STATUS_COPY[d.status];
  return {
    to,
    subject: copy.subject(d.collegeName),
    html: layout({
      preheader: copy.line,
      heading: copy.heading,
      body: p(`<strong>${esc(d.collegeName)}</strong> · ${esc(brandedSeason(d.leagueName))}`) + p(copy.line),
    }),
    text: `${d.collegeName} · ${brandedSeason(d.leagueName)}\n\n${copy.line}`,
  };
}

/** Invite with a one-time sign-in link (from auth.admin.generateLink). */
export function invitedEmail(
  to: string,
  d: { link: string; role: "admin" | "viewer" | "poc"; collegeName?: string; approved?: boolean; existingUser?: boolean },
): Email {
  const where = d.role === "poc" ? (d.collegeName ? `manage <strong>${esc(d.collegeName)}</strong>` : "manage your college") : "the league admin panel";
  const heading = d.approved ? "You're approved. Here's your invite" : "You're invited";
  const lead = d.approved && d.collegeName ? p(`<strong>${esc(d.collegeName)}</strong> is approved for the league. 🎉`) : "";
  return {
    to,
    subject: d.role === "poc" ? `Your invite to manage ${d.collegeName ?? "your college"} · Matiks College League` : "Your invite to the Matiks College League admin",
    html: layout({
      preheader: "Your sign-in link is inside.",
      heading,
      body:
        lead +
        p(`You've been given access to ${where}.`) +
        (d.role === "poc" ? p("Sign in to add your team's contacts and, later, your winners' details.") : ""),
      cta: { label: d.existingUser ? "Sign in" : "Accept invite", href: d.link },
      footnote: d.existingUser
        ? "Sign in with this email address. If you never set a password, use “Email me a login link”."
        : `The link works once. If it has expired, go to ${esc(SITE.replace(/^https?:\/\//, ""))}/login and choose “Email me a login link”.`,
    }),
    text: `${d.approved && d.collegeName ? `${d.collegeName} is approved for the league.\n\n` : ""}You've been given access to ${d.role === "poc" ? `manage ${d.collegeName ?? "your college"}` : "the league admin panel"}.\n\n${d.existingUser ? "Sign in" : "Accept your invite"}: ${d.link}`,
  };
}

export function winnerPaidEmail(
  to: string | string[],
  d: { winnerName: string; position: string; collegeName: string; leagueName: string; amount: string | null; utr: string },
): Email {
  return {
    to,
    subject: `Prize paid: ${d.position} · ${d.collegeName}`,
    html: layout({
      preheader: `UTR ${d.utr}`,
      heading: "Your prize is on its way 💸",
      body:
        p(`Congratulations ${esc(d.winnerName)}! Your prize (${esc(d.position)}) for <strong>${esc(d.collegeName)}</strong> (${esc(brandedSeason(d.leagueName))}) has been paid${d.amount ? `: <strong>${esc(d.amount)}</strong>` : ""}.`) +
        p(`${muted("UTR / transaction reference")}<br>${mono(d.utr)}`) +
        p("It can take a few hours to show in your bank account. Reply to this email if it hasn't arrived in 2 working days."),
    }),
    text: `Congratulations ${d.winnerName}! Your prize (${d.position}) for ${d.collegeName} (${brandedSeason(d.leagueName)}) has been paid${d.amount ? `: ${d.amount}` : ""}.\n\nUTR: ${d.utr}`,
  };
}

