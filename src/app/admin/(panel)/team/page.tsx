import type { Metadata } from "next";
import { Suspense } from "react";

import { AccessList, type AccessEntry } from "@/components/admin/team/access-list";
import { InviteForm } from "@/components/admin/team/invite-form";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { getOverview } from "@/lib/data/league-ops";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage Access" };

export default function TeamPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">Admins, viewers and college POCs.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Team />
      </Suspense>
    </div>
  );
}

async function Team() {
  const [{ profile, isWriter }, league] = await Promise.all([requireAdmin(), getSelectedLeague()]);
  const supabase = await createClient();
  const [admins, access, colleges] = await Promise.all([
    supabase.from("admin_profiles").select("user_id, email, name, role").order("role").order("email"),
    supabase
      .from("college_access")
      .select("user_id, registration_id, registrations(colleges(name), leagues(name))")
      .order("created_at", { ascending: false }),
    league ? getOverview(league.id) : Promise.resolve([]),
  ]);

  // Emails and last sign-in live in auth.users: read them with the service role, one user at a time
  // (never listUsers(), which only returns the first page).
  const ids = [...new Set([...(admins.data ?? []).map((a) => a.user_id), ...(access.data ?? []).map((a) => a.user_id)])];
  const authAdmin = createAdminClient().auth.admin;
  const users = new Map(
    (await Promise.all(ids.map((id) => authAdmin.getUserById(id)))).flatMap((r) => (r.data.user ? [[r.data.user.id, r.data.user]] : [])),
  );

  const entries: AccessEntry[] = [
    ...(admins.data ?? []).map((a) => ({
      key: `admin-${a.user_id}`,
      userId: a.user_id,
      email: a.email,
      name: a.name,
      role: a.role,
      registrationId: null,
      college: null,
      season: null,
      lastSignInAt: users.get(a.user_id)?.last_sign_in_at ?? null,
      isMe: a.user_id === profile.user_id,
    })),
    ...(access.data ?? []).map((a) => ({
      key: `poc-${a.user_id}-${a.registration_id}`,
      userId: a.user_id,
      email: users.get(a.user_id)?.email ?? "unknown",
      name: null,
      role: "poc" as const,
      registrationId: a.registration_id,
      college: a.registrations.colleges.name,
      season: a.registrations.leagues.name,
      lastSignInAt: users.get(a.user_id)?.last_sign_in_at ?? null,
      isMe: a.user_id === profile.user_id,
    })),
  ];

  return (
    <div className="space-y-8">
      {isWriter && (
        <InviteForm
          seasonName={league?.name ?? "no season"}
          colleges={colleges.map((c) => ({ id: c.registration_id!, name: c.college_name! }))}
        />
      )}
      <section className="space-y-3">
        <h2 className="text-2xl">People with access ({entries.length})</h2>
        <AccessList entries={entries} canWrite={isWriter} />
        <p className="text-xs text-muted-foreground">
          A college&apos;s registration email can also sign in to that college without an invite.
        </p>
      </section>
    </div>
  );
}
