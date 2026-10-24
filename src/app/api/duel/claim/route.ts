import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { cleanFirstName } from "@/lib/duel/profanity";
import { CLAIM_WINDOW_MS, verifyRound } from "@/lib/duel/server";
import { createAdminClient } from "@/lib/supabase/admin";

const noStore = { "Cache-Control": "no-store" };

const bodySchema = z.object({
  token: z.string().max(400),
  name: z.string().max(60).optional(),
  collegeId: z.uuid().nullable().optional(),
  /** Also make a "Challenge a friend" link for this score. */
  invite: z.boolean().optional(),
});

/**
 * After a scored round: optional first name + college ("Top today" shows first name and college only), and/or a
 * personal challenge link (/i/CODE) carrying the score to beat. Only the round's own token can do this.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  const claims = verifyRound(parsed.data.token);
  if (!claims) return NextResponse.json({ error: "That round isn't valid." }, { status: 400, headers: noStore });

  const admin = createAdminClient();
  const { data: round } = await admin.from("duel_rounds").select("id, score, submitted_at, player_name, college_id").eq("id", claims.id).maybeSingle();
  if (!round?.submitted_at || round.score == null) return NextResponse.json({ error: "Finish the round first." }, { status: 409, headers: noStore });
  if (Date.now() - new Date(round.submitted_at).getTime() > CLAIM_WINDOW_MS) {
    return NextResponse.json({ error: "Too late to change this round. Play another!" }, { status: 410, headers: noStore });
  }

  let name = round.player_name;
  if (parsed.data.name !== undefined && parsed.data.name.trim()) {
    name = cleanFirstName(parsed.data.name);
    if (!name) return NextResponse.json({ error: "Use your first name (letters only)." }, { status: 422, headers: noStore, });
  }
  let collegeId = round.college_id;
  if (parsed.data.collegeId !== undefined) {
    collegeId = parsed.data.collegeId;
    if (collegeId) {
      const { data: c } = await admin.from("colleges").select("id").eq("id", collegeId).maybeSingle();
      if (!c) return NextResponse.json({ error: "Pick your college again." }, { status: 422, headers: noStore });
    }
  }
  if (name !== round.player_name || collegeId !== round.college_id) {
    const { error } = await admin.from("duel_rounds").update({ player_name: name, college_id: collegeId }).eq("id", round.id);
    if (error) return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500, headers: noStore });
    revalidateTag(CACHE_TAGS.duels, { expire: 0 });
  }

  let code: string | null = null;
  if (parsed.data.invite) {
    for (let attempt = 0; attempt < 3 && !code; attempt++) {
      const { data: generated } = await admin.rpc("new_invite_code");
      const { data, error } = await admin
        .from("invite_codes")
        .insert({ code: generated as string, kind: "player", display_name: name, college_id: collegeId, score: round.score })
        .select("code")
        .single();
      if (!error) code = data.code;
    }
    if (!code) return NextResponse.json({ error: "Couldn't make your link. Please try again." }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ ok: true, name, code }, { headers: noStore });
}
