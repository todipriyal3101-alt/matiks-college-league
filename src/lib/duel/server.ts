import "server-only";

import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

// Duel anti-cheat (server only). The server issues a signed round (id + seed + expiry); the browser plays it and
// sends answers + timings back; the server checks the signature, replays the round from the seed and scores it.

const SECRET = process.env.DUEL_SECRET ?? "";
/** Time to start playing after the round is issued, plus the 30 seconds. */
export const ROUND_TTL_MS = 3 * 60_000;
/** Rounds per IP: 30 per 10 minutes, 300 per day. */
const LIMITS = [
  { minutes: 10, max: 30 },
  { minutes: 24 * 60, max: 300 },
];
/** Name / college / challenge link can be added up to this long after finishing. */
export const CLAIM_WINDOW_MS = 30 * 60_000;

export function duelConfigured() {
  return SECRET.length >= 32;
}

function hmac(payload: string) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export type RoundClaims = { id: string; seed: number; exp: number };

export function signRound(c: RoundClaims) {
  const payload = Buffer.from(JSON.stringify(c)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/** The round in a token, if the signature is ours (expiry is checked by the caller). */
export function verifyRound(token: unknown): RoundClaims | null {
  if (typeof token !== "string" || token.length > 400) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const want = Buffer.from(hmac(payload));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, "base64url").toString()) as RoundClaims;
    return typeof c.id === "string" && Number.isInteger(c.seed) && Number.isInteger(c.exp) ? c : null;
  } catch {
    return null;
  }
}

export function newSeed() {
  return randomInt(1, 2 ** 31 - 1);
}

/** Salted, per-day hash of the IP: enough to rate-limit, useless for tracking anyone. */
export function ipHash(ip: string | null) {
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${SECRET}|${day}|${ip ?? "unknown"}`).digest("hex").slice(0, 32);
}

export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}

/** True when this IP hash has started too many rounds recently. */
export async function rateLimited(hash: string): Promise<boolean> {
  const admin = createAdminClient();
  for (const { minutes, max } of LIMITS) {
    const since = new Date(Date.now() - minutes * 60_000).toISOString();
    const { count, error } = await admin.from("duel_rounds").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("issued_at", since);
    if (error) {
      console.error("duel rateLimited:", error.message);
      return false;
    }
    if ((count ?? 0) >= max) return true;
  }
  return false;
}
