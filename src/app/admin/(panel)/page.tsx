import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminDashboardPage() {
  const [{ profile, isWriter }, league] = await Promise.all([requireAdmin(), getSelectedLeague()]);
  return (
    <div className="space-y-2">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        {league ? `Season: ${league.name}` : "No season selected"} · Signed in as {profile.email} (
        {isWriter ? "admin" : "viewer, read-only"})
      </p>
      <p className="text-sm text-muted-foreground">Stats and charts come in phase 6.</p>
    </div>
  );
}
