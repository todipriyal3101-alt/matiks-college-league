import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { MAX_QUESTIONS, scoreRound } from "@/lib/duel/engine";
import { verifyRound } from "@/lib/duel/server";
import { createAdminClient } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store" };

const bodySchema = z.object({
  token: z.string().max(400),
  answers: z.array(z.object({ i: z.number().int().min(0), a: z.number().int().min(-100000).max(1000000), t: z.number().min(0).max(120000) })).max(MAX_QUESTIONS),
});

/** Verifies the signed round, replays it from the seed, scores it (once), and returns the result + today's rank. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  const claims = verifyRound(parsed.data.token);
  if (!claims) return NextResponse.json({ error: "That round isn't valid." }, { status: 400, headers: noStore });
  if (Date.now() > claims.exp) return NextResponse.json({ error: "That round expired. Play another!" }, { status: 410, headers: noStore });

  const admin = createAdminClient();
  const { data: round } = await admin.from("duel_rounds").select("id, seed, issued_at, submitted_at").eq("id", claims.id).maybeSingle();
  if (!round || round.seed !== claims.seed) return NextResponse.json({ error: "That round isn't valid." }, { status: 400, headers: noStore });
  if (round.submitted_at) return NextResponse.json({ error: "This round was already scored." }, { status: 409, headers: noStore });

  // Real time since the round was issued bounds the claimed answer times.
  const elapsed = Date.now() - new Date(round.issued_at).getTime();
  const result = scoreRound(round.seed, parsed.data.answers, elapsed);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 422, headers: noStore });

  const { data: saved, error } = await admin
    .from("duel_rounds")
    .update({ submitted_at: new Date().toISOString(), score: result.score, correct: result.correct, attempted: result.attempted, best_combo: result.bestCombo })
    .eq("id", round.id)
    .is("submitted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !saved) return NextResponse.json({ error: "This round was already scored." }, { status: 409, headers: noStore });

  // Rank among today's rounds (midnight IST = UTC+5:30, no daylight saving), named or not.
  const IST = 5.5 * 3600_000;
  const DAY = 86_400_000;
  const since = new Date(Math.floor((Date.now() + IST) / DAY) * DAY - IST).toISOString();
  const { count } = await admin
    .from("duel_rounds")
    .select("id", { count: "exact", head: true })
    .gte("submitted_at", since)
    .eq("hidden", false)
    .gt("score", result.score);
  return NextResponse.json({ ...result, rank: (count ?? 0) + 1 }, { headers: noStore });
}
