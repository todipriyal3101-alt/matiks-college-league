import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { slug } from "@/lib/logos";
import { passImage } from "@/lib/pass-art";
import { createClient } from "@/lib/supabase/server";

/** The signed-in POC's Campus Lead Pass as a PNG (?r=registration; ?download=1 to save). RLS limits it to their own. */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  const r = request.nextUrl.searchParams.get("r") ?? "";
  if (!z.uuid().safeParse(r).success) return new NextResponse("Not found", { status: 404, headers });

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return new NextResponse("Sign in", { status: 401, headers });
  const { data: row } = await supabase
    .from("registration_overview")
    .select("college_name, league_name, review_status, email_verified_at, college_logo_url, club_logo_url, pass_code, primary_poc_name")
    .eq("registration_id", r)
    .maybeSingle();
  if (!row?.pass_code) return new NextResponse("Not found", { status: 404, headers });

  // Each teammate's pass carries their own name (the contact with their login email), else the account name.
  const email = (claims.claims.email ?? "").toLowerCase();
  const { data: me } = await supabase.from("contacts").select("name").eq("registration_id", r).ilike("email", email).maybeSingle();
  const meta = (claims.claims.user_metadata ?? {}) as { name?: string };
  const name = me?.name ?? meta.name ?? row.primary_poc_name ?? "Campus Lead";

  const png = await passImage({
    name,
    college: row.college_name ?? "",
    season: row.league_name ?? "Matiks College League",
    status: row.review_status ?? "pending",
    verified: !!row.email_verified_at,
    collegeLogoUrl: row.college_logo_url,
    clubLogoUrl: row.club_logo_url,
    code: row.pass_code,
  });
  const body = new Uint8Array(await png.arrayBuffer());
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(body, {
    headers: { ...headers, "Content-Type": "image/png", ...(download && { "Content-Disposition": `attachment; filename="Campus-Lead-Pass-${slug(row.college_name ?? "college")}.png"` }) },
  });
}
