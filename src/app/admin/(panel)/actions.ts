"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_LEAGUE_COOKIE, getSelectedLeague } from "@/lib/data/admin-leagues";
import { getOverview } from "@/lib/data/league-ops";

/** Season picker: remembers the selected league for every admin page. Viewers may switch too (read-only). */
export async function selectLeague(leagueId: string) {
  await requireAdmin();
  const id = z.uuid().parse(leagueId);
  (await cookies()).set(ADMIN_LEAGUE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export type PaletteCollege = { registrationId: string; name: string; city: string | null; status: string };

/** ⌘K palette: colleges of the selected season (admins and viewers). */
export async function paletteColleges(): Promise<PaletteCollege[]> {
  await requireAdmin();
  const league = await getSelectedLeague();
  if (!league) return [];
  const rows = await getOverview(league.id);
  return rows.map((r) => ({ registrationId: r.registration_id!, name: r.college_name!, city: r.city, status: r.review_status! }));
}
