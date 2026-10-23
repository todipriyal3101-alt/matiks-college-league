"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_LEAGUE_COOKIE } from "@/lib/data/admin-leagues";
import { getPeople, type PersonHit } from "@/lib/data/people";
import { COUNTRY_COOKIE, getAdminCountry, getRegistrations } from "@/lib/data/portal";
import { COUNTRIES } from "@/lib/validation/portal";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/admin",
  maxAge: 60 * 60 * 24 * 365,
} as const;

/** Season picker (Matches page): remembers the selected league. Viewers may switch too (read-only). */
export async function selectLeague(leagueId: string) {
  await requireAdmin();
  (await cookies()).set(ADMIN_LEAGUE_COOKIE, z.uuid().parse(leagueId), cookieOptions);
}

/** The India / USA switch: remembered per browser, filters every admin number and list. */
export async function setAdminCountry(country: string) {
  await requireAdmin();
  (await cookies()).set(COUNTRY_COOKIE, z.enum(COUNTRIES).parse(country), cookieOptions);
  refresh();
}

export type PaletteCollege = { registrationId: string; name: string; city: string | null; status: string; league: string | null };

/** ⌘K palette and the Search page: colleges, POCs and winners of the selected country, all seasons. */
export async function paletteData(): Promise<{ colleges: PaletteCollege[]; people: PersonHit[] }> {
  await requireAdmin();
  const country = await getAdminCountry();
  const [rows, people] = await Promise.all([getRegistrations(country), getPeople(country)]);
  return {
    colleges: rows.map((r) => ({
      registrationId: r.registration_id!,
      name: r.college_name!,
      city: r.city,
      status: r.review_status!,
      league: r.league_name,
    })),
    people,
  };
}
