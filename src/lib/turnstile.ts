import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Verifies a Cloudflare Turnstile token. Returns false on any failure. */
export async function verifyTurnstile(token: string, remoteIp?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("verifyTurnstile: TURNSTILE_SECRET_KEY is not set");
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, cache: "no-store" });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (error) {
    console.error("verifyTurnstile:", error);
    return false;
  }
}
