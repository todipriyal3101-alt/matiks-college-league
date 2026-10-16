"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_LEAGUE_COOKIE } from "@/lib/data/admin-leagues";
import { createClient } from "@/lib/supabase/server";

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

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
