import type { Metadata } from "next";
import { Suspense } from "react";

import { SeasonBar } from "@/components/admin/season-bar";
import { AccessList, type AccessEntry } from "@/components/admin/team/access-list";
import { InviteForm } from "@/components/admin/team/invite-form";
import { PendingList, type PendingEntry } from "@/components/admin/team/pending-list";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { accessMessage } from "@/lib/auth/invite";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { getOverview } from "@/lib/data/league-ops";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage Admins" };

export default function TeamPage() {
  return (
    <div className="fade-in space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl sm:text-6xl">Manage Admins</h1>
          <p className="mt-1 text-sm text-muted-foreground">Admins, viewers and college POCs.</p>
        </div>
        <SeasonBar />
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Team />
      </Suspense>
    </div>
  );
}

const now = () => Date.now();

async function Team() {
  const [{ profile, isWriter }, league] = await Promise.all([requireAdmin(), getSelectedLeague()]);
  const supabase = await createClient();
  const [admins, access, colleges, pendingRows] = await Promise.all([
    supabase.from("admin_profiles").select("user_id, email, name, role").order("role").order("email"),
    supabase
      .from("college_access")
      .select("user_id, registration_id, registrations(colleges(name), leagues(name))")
      .order("created_at", { ascending: false }),
    league ? getOverview(league.id) : Promise.resolve([]),
    // POC access waiting for a sign-up (0009): open entries, newest first (expired ones shown until revoked).
    supabase
      .from("pending_access")
      .select("id, email, expires_at, registrations(colleges(name), leagues(name), contacts(name, email))")
      .is("claimed_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Emails and last sign-in live in auth.users: read them with the service role, one user at a time
  // (never listUsers(), which only returns the first page).
  const ids = [...new Set([...(admins.data ?? []).map((a) => a.user_id), ...(access.data ?? []).map((a) => a.user_id)])];
  const authAdmin = createAdminClient().auth.admin;
  const [users, { data: verifiedRows }] = await Promise.all([
    Promise.all(ids.map((id) => authAdmin.getUserById(id))).then(
      (rs) => new Map(rs.flatMap((r) => (r.data.user ? [[r.data.user.id, r.data.user] as const] : []))),
    ),
    supabase.from("verified_accounts").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const verified = new Set((verifiedRows ?? []).map((v) => v.user_id));

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
      verified: verified.has(a.user_id),
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
      verified: verified.has(a.user_id),
      isMe: a.user_id === profile.user_id,
    })),
  ];
  const pending: PendingEntry[] = (pendingRows.data ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    college: p.registrations.colleges.name,
    season: p.registrations.leagues.name,
    expiresAt: p.expires_at,
    message: accessMessage({
      email: p.email,
      name: p.registrations.contacts.find((c) => c.email.toLowerCase() === p.email)?.name,
      collegeName: p.registrations.colleges.name,
      role: "poc",
    }),
  }));

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
      </section>
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-2xl">Waiting for sign-up ({pending.length})</h2>
          <PendingList entries={pending} canWrite={isWriter} now={now()} />
          <p className="text-xs text-muted-foreground">They get access when they sign up with that exact email. Entries expire after 14 days.</p>
        </section>
      )}
    </div>
  );
}
