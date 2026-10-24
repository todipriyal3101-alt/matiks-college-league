import { NextResponse, type NextRequest } from "next/server";

import { clientIp, duelConfigured, ipHash, newSeed, rateLimited, ROUND_TTL_MS, signRound } from "@/lib/duel/server";
import { INVITE_CODE_RE, INVITE_COOKIE } from "@/lib/invite-cookie";
import { createAdminClient } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store" };

/** Issues a signed round (seed + expiry). No sign-up; rate-limited per IP. */
export async function POST(request: NextRequest) {
  if (!duelConfigured()) return NextResponse.json({ error: "The duel isn't set up yet." }, { status: 503, headers: noStore });
  const hash = ipHash(clientIp(request.headers));
  if (await rateLimited(hash)) {
    return NextResponse.json({ error: "That's a lot of duels! Take a breather and try again in a few minutes." }, { status: 429, headers: noStore });
  }

  const admin = createAdminClient();
  const cookieCode = request.cookies.get(INVITE_COOKIE)?.value;
  let invite: string | null = null;
  if (cookieCode && INVITE_CODE_RE.test(cookieCode)) {
    const { data } = await admin.from("invite_codes").select("code").eq("code", cookieCode).maybeSingle();
    invite = data?.code ?? null;
  }

  const seed = newSeed();
  const exp = Date.now() + ROUND_TTL_MS;
  const { data, error } = await admin
    .from("duel_rounds")
    .insert({ seed, ip_hash: hash, expires_at: new Date(exp).toISOString(), invite_code: invite })
    .select("id")
    .single();
  if (error) {
    console.error("duel start:", error.message);
    return NextResponse.json({ error: "Couldn't start a duel. Please try again." }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ token: signRound({ id: data.id, seed, exp }), seed }, { headers: noStore });
}
