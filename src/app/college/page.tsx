import { BuildingIcon, LockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { EmptyState } from "@/components/league/empty-state";
import { PrizeProgress } from "@/components/launch/prize-progress";
import { BadgesCard } from "@/components/portal/badges-card";
import { CertificatesCard } from "@/components/portal/certificates-card";
import { CollegeCardShare } from "@/components/portal/college-card-share";
import { EditDetailsForm } from "@/components/portal/edit-details-form";
import { InviteCard } from "@/components/portal/invite-card";
import { CampusPass } from "@/components/portal/campus-pass";
import { SquadCard } from "@/components/portal/squad-card";
import { StatusTracker } from "@/components/portal/status-tracker";
import { SuccessHero } from "@/components/portal/success-hero";
import { RegisterChecklist } from "@/components/portal/register-checklist";
import { TeamContacts } from "@/components/portal/team-contacts";
import { RegisterFlow } from "@/components/register/register-flow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdmin } from "@/lib/auth/admin";
import { getRegistrationDetail, type OverviewRow } from "@/lib/data/league-ops";
import { getPocContext, pickRegistration, type PocContext } from "@/lib/data/poc";
import { getActivityFeed, getEarlyBirdLeft, getHomeStats } from "@/lib/data/public";
import { SQUAD_CODE_RE, SQUAD_COOKIE } from "@/lib/invite-cookie";
import { emailEnabled } from "@/lib/email";
import { getOverviewRow, getRegistrationsPaused } from "@/lib/data/portal";
import { passQrSvg, passUrl } from "@/lib/pass";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatDay, todayIst } from "@/lib/ist";
import { SUPPORT_EMAIL, type Stage } from "@/lib/league";
import { COUNTRY_FLAGS, COUNTRY_LABELS, detailsFromRow, registerDraftSchema, type Country } from "@/lib/validation/portal";

import { SeasonSwitch } from "./season-switch";

export const metadata: Metadata = { title: "Register" };

/** Register tab: the form for a POC with no college yet; afterwards their status, and editing while pending/denied. */
export default function RegisterTab({ searchParams }: PageProps<"/college">) {
  return (
    <Suspense fallback={<RegisterSkeleton />}>
      <Register searchParams={searchParams} />
    </Suspense>
  );
}

async function Register({ searchParams }: Pick<PageProps<"/college">, "searchParams">) {
  const [ctx, { r, registered, joined }] = await Promise.all([getPocContext(), searchParams]);
  if (!ctx) return null;

  if (ctx.registrations.length === 0) {
    // Admins land here from a shared /college link: point them to the admin panel, not to registering.
    if (await getAdmin()) {
      return (
        <EmptyState
          icon={BuildingIcon}
          title="This is the POC portal"
          description="You're signed in as a Matiks admin, so there's no college here. Manage colleges from the admin panel."
          action={
            <Button asChild className="h-11">
              <Link href="/admin">Go to admin</Link>
            </Button>
          }
        />
      );
    }
    // Always open: only the admin's emergency "Pause new registrations" closes it (read uncached).
    const paused = await getRegistrationsPaused();
    if (paused) {
      return (
        <div className="fade-in space-y-6">
          <Heading eyebrow="Matiks College League" title="Register your college" />
          <Glass className="p-6">
            <EmptyState
              icon={LockIcon}
              title="New registrations are paused"
              description={
                <>
                  Message us in the Chat tab, or write to{" "}
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </>
              }
            />
          </Glass>
        </div>
      );
    }
    return <ClaimAndRegister ctx={ctx} />;
  }

  const selected = pickRegistration(ctx, r)!;
  const supabase = await createClient();
  // Time-based badges (e.g. Champion once the league is over) are checked on open; the database awards + notifies.
  if (selected.status === "approved") await supabase.rpc("refresh_my_badges", { p_registration_id: selected.id });
  const [row, { data: own }, detail, invite, { data: certificates }, { data: collegeRow }, { data: badges }] = await Promise.all([
    getOverviewRow(selected.id),
    // The registration's own columns: the view's logo falls back to the college master record's.
    supabase
      .from("registrations")
      .select("college_email, email_domain, college_logo_url, club_name, club_logo_url, registration_start, league_start, league_end")
      .eq("id", selected.id)
      .maybeSingle(),
    getRegistrationDetail(selected.id),
    // The POC's personal invite link (made on first visit) + people who came through it.
    supabase.rpc("my_invite", { p_registration_id: selected.id }).then(({ data }) => data?.[0] ?? null),
    supabase.from("certificates").select("id, recipient_name, issued_at, hidden").eq("registration_id", selected.id).order("issued_at"),
    supabase.from("registrations").select("colleges(slug)").eq("id", selected.id).maybeSingle(),
    supabase.from("badges").select("badge").eq("registration_id", selected.id),
  ]);
  const approved = row?.review_status === "approved";
  if (!row || !own || !detail) return <EmptyState icon={BuildingIcon} title="College not found" description="It may have been removed." />;
  const status = row.review_status!;
  const editable = status === "pending" || status === "rejected";
  const active = status === "pending" || status === "waitlisted" || approved;
  // Campus Lead Pass (my own name on it), co-lead links for open spots, and "Ask to join" requests.
  const [qrSvg, { data: invites }, { data: requests }] = await Promise.all([
    row.pass_code ? passQrSvg(row.pass_code) : Promise.resolve(""),
    active ? supabase.rpc("my_squad_invites", { p_registration_id: selected.id }) : Promise.resolve({ data: [] }),
    supabase.from("join_requests").select("id, name").eq("registration_id", selected.id).eq("status", "pending").order("created_at"),
  ]);
  const myName = detail.contacts.find((c) => c.email.toLowerCase() === ctx.email.toLowerCase())?.name ?? ctx.name ?? row.primary_poc_name ?? "Campus Lead";
  const pass = row.pass_code && status !== "rejected" && (
    <CampusPass
      registrationId={selected.id}
      name={myName}
      college={row.college_name ?? ""}
      season={row.league_name ?? "Matiks College League"}
      status={status}
      verified={!!row.email_verified_at}
      target={row.target_players}
      collegeLogoUrl={row.college_logo_url}
      clubLogoUrl={row.club_logo_url}
      code={row.pass_code}
      qrSvg={qrSvg}
      url={passUrl(row.pass_code)}
    />
  );
  const squad = active && (
    <SquadCard
      members={detail.contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, is_primary: c.is_primary }))}
      invites={(invites ?? []).map((i) => i.code)}
      requests={requests ?? []}
      siteUrl={siteUrl}
      myEmail={ctx.email}
      college={row.college_name ?? "your college"}
      highlight={!!registered}
    />
  );

  return (
    <div className="fade-in space-y-5">
      {ctx.registrations.length > 1 && (
        <SeasonSwitch
          selectedId={selected.id}
          options={ctx.registrations.map((m) => ({ id: m.id, label: `${m.leagues.name} · ${m.colleges.name}` }))}
        />
      )}
      {registered ? (
        <SuccessHero college={row.college_name ?? "your college"} />
      ) : (
        <Heading eyebrow={row.league_name ?? "Matiks College League"} title={row.college_name ?? "Your college"} />
      )}
      {joined && !registered && (
        <Glass className="p-4 text-sm font-semibold sm:p-5">🎉 You&apos;re on the {row.college_name} team. Everything here is shared with your Campus Leads.</Glass>
      )}
      {registered && pass}
      {registered && squad}
      {registered && invite && <InviteCard code={invite.code} plays={invite.plays} registrations={invite.registrations} collegeName={row.college_name ?? ""} siteUrl={siteUrl} highlight />}
      <StatusTracker row={row} />
      {!registered && pass}
      {!registered && squad}
      {!registered && invite && <InviteCard code={invite.code} plays={invite.plays} registrations={invite.registrations} collegeName={row.college_name ?? ""} siteUrl={siteUrl} />}
      <Glass className="p-5 sm:p-6">
        <PrizeProgress players={row.participant_count ?? 0} country={(row.country ?? "india") as Country} />
      </Glass>
      {approved && collegeRow?.colleges.slug && <CollegeCardShare slug={collegeRow.colleges.slug} collegeName={row.college_name ?? ""} />}
      <CertificatesCard certificates={certificates ?? []} siteUrl={siteUrl} />
      {approved && <BadgesCard registrationId={selected.id} earned={(badges ?? []).map((b) => b.badge)} />}
      <RegisterChecklist
        status={status}
        stage={(row.effective_stage ?? "registration_phase") as Stage}
        contacts={detail.contacts}
        winners={detail.winners}
      />
      <Glass id="details" className="scroll-mt-28 p-5 sm:p-7">
        {editable ? (
          <EditDetailsForm registrationId={selected.id} initial={detailsFromRow(own)} denied={status === "rejected"} />
        ) : (
          <DetailsSummary row={row} />
        )}
      </Glass>
      <TeamContacts registrationId={selected.id} contacts={detail.contacts} />
    </div>
  );
}

/** No registration yet: claim screen → stepper (resumes the autosaved draft), with live ticker + early-bird spots. */
async function ClaimAndRegister({ ctx }: { ctx: PocContext }) {
  const supabase = await createClient();
  // Came through a co-lead link (/j/CODE, remembered through sign-up): join that team now.
  const squadCode = (await cookies()).get(SQUAD_COOKIE)?.value;
  let squadError: string | null = null;
  if (squadCode && SQUAD_CODE_RE.test(squadCode)) {
    const { error } = await supabase.rpc("redeem_squad_invite", { p_code: squadCode });
    if (!error) redirect("/college?joined=1");
    squadError = error.code === "P0001" ? error.message : "Couldn't join that team. Ask your Campus Lead for a new link.";
  }
  const [{ data: draftRow }, { data: join }, activity, earlyBirdLeft, stats] = await Promise.all([
    supabase.from("registration_drafts").select("data").eq("user_id", ctx.userId).maybeSingle(),
    // The requester can't read the team's registration (RLS); the server looks up just the college's name.
    createAdminClient().from("join_requests").select("id, registrations(colleges(name))").eq("user_id", ctx.userId).eq("status", "pending").maybeSingle(),
    getActivityFeed().catch(() => []),
    getEarlyBirdLeft().catch(() => 0),
    getHomeStats().catch(() => null),
  ]);
  const parsed = registerDraftSchema.safeParse(draftRow?.data ?? null);
  const draft = parsed.success ? parsed.data : null;
  const draftEmail = typeof draft?.details?.collegeEmail === "string" ? draft.details.collegeEmail : "";
  const draftVerified = draftEmail ? !!(await supabase.rpc("my_email_verified", { p_email: draftEmail })).data : false;
  return (
    <div className="fade-in">
      <RegisterFlow
        userId={ctx.userId}
        email={ctx.email}
        profile={{ name: ctx.name, phone: ctx.phone }}
        season={stats?.season ?? "Matiks College League"}
        today={todayIst()}
        draft={draft}
        activity={activity}
        earlyBirdLeft={earlyBirdLeft}
        pendingJoin={join ? { id: join.id, collegeName: join.registrations?.colleges.name ?? "that college" } : null}
        verifyEnabled={emailEnabled()}
        draftVerified={draftVerified}
        squadError={squadError}
      />
    </div>
  );
}

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
      <h1 className="text-5xl sm:text-6xl">{title}</h1>
      {children && <p className="mt-3 max-w-xl text-foreground/85">{children}</p>}
    </div>
  );
}

function DetailsSummary({ row }: { row: OverviewRow }) {
  const country = (row.country ?? "india") as Country;
  const items: [string, React.ReactNode][] = [
    ["Country", `${COUNTRY_FLAGS[country]} ${COUNTRY_LABELS[country]}`],
    ["College email", row.college_email],
    ["Email domain", row.email_domain && `@${row.email_domain}`],
    ["Hosted by", row.club_name],
    ["Registration start", formatDay(row.registration_start)],
    ["League start", formatDay(row.league_start)],
    ["League end", formatDay(row.league_end)],
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LockIcon className="size-4" aria-hidden /> Approved details are locked. Message us in Chat to change them.
      </div>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
            <dd className="text-sm">{value || "—"}</dd>
          </div>
        ))}
      </dl>
      {row.club_logo_url && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from our public bucket */}
          <img src={row.club_logo_url} alt={`${row.club_name ?? "Club"} logo`} className="size-12 rounded-xl bg-white object-contain p-0.5" />
          <span className="text-sm text-muted-foreground">Club logo</span>
        </div>
      )}
    </div>
  );
}

function RegisterSkeleton() {
  return (
    <div className="space-y-6" aria-hidden>
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-[34rem] w-full rounded-3xl" />
    </div>
  );
}
