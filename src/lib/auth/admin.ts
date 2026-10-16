import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = Pick<Tables<"admin_profiles">, "user_id" | "name" | "email" | "role">;

export type AdminContext = {
  profile: AdminProfile;
  /** role 'admin' (same rule as is_admin_writer()); viewers can read but never write or export. */
  isWriter: boolean;
};

/**
 * The logged-in user's admin profile, or null. Read once per request.
 * RLS lets a user read only their own admin_profiles row, so this is the same check as is_admin().
 */
export const getAdmin = cache(async (): Promise<AdminContext | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("user_id, name, email, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return null;

  return { profile, isWriter: profile.role === "admin" };
});

/** For admin server components and actions: any admin (admin or viewer), else redirect to login. */
export async function requireAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) redirect("/login?next=/admin");
  return admin;
}

/** For admin server actions that write or export: role 'admin' only. Viewers are rejected. */
export async function requireAdminWriter(): Promise<AdminContext> {
  const admin = await requireAdmin();
  if (!admin.isWriter) throw new Error("Forbidden: viewers can't make changes.");
  return admin;
}
