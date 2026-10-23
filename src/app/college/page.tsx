import { BuildingIcon, CircleCheckIcon, ClockIcon, LockIcon, MessageCircleIcon, XCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { StageBadge } from "@/components/league/badges";
import { CollegeLogo } from "@/components/league/college-logo";
import { EmptyState } from "@/components/league/empty-state";
import { EmptyStateSticker } from "@/components/stickers";
import { EditDetailsForm } from "@/components/portal/edit-details-form";
import { RegisterChecklist } from "@/components/portal/register-checklist";
import { TeamContacts } from "@/components/portal/team-contacts";
import { RegisterForm } from "@/components/portal/register-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdmin } from "@/lib/auth/admin";
import { getRegistrationDetail, type OverviewRow } from "@/lib/data/league-ops";
import { getPocContext, pickRegistration } from "@/lib/data/poc";
import { getOverviewRow, getRegistrationsPaused } from "@/lib/data/portal";
import { createClient } from "@/lib/supabase/server";
import { formatDay } from "@/lib/ist";
import { SUPPORT_EMAIL, type Stage } from "@/lib/league";
import { stageLine } from "@/lib/stage-line";
import { cn } from "@/lib/utils";
import { COUNTRY_FLAGS, COUNTRY_LABELS, detailsFromRow, type Country } from "@/lib/validation/portal";

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
  const [ctx, { r }] = await Promise.all([getPocContext(), searchParams]);
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
    return (
      <div className="fade-in space-y-6">
        <Heading eyebrow="Matiks College League" title="Register your college">
          Tell us about your college and when you want to run the league. A Matiks admin reviews it, usually within a day.
        </Heading>
        {paused ? (
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
        ) : (
          <RegisterForm userId={ctx.userId} email={ctx.email} profile={{ name: ctx.name, phone: ctx.phone }} />
        )}
      </div>
    );
  }

  const selected = pickRegistration(ctx, r)!;
  const supabase = await createClient();
  const [row, { data: own }, detail] = await Promise.all([
    getOverviewRow(selected.id),
    // The registration's own columns: the view's logo falls back to the college master record's.
    supabase
      .from("registrations")
      .select("college_email, email_domain, college_logo_url, club_name, club_logo_url, registration_start, league_start, league_end")
      .eq("id", selected.id)
      .maybeSingle(),
    getRegistrationDetail(selected.id),
  ]);
  if (!row || !own || !detail) return <EmptyState icon={BuildingIcon} title="College not found" description="It may have been removed." />;
  const status = row.review_status!;
  const editable = status === "pending" || status === "rejected";

  return (
    <div className="fade-in space-y-5">
      {ctx.registrations.length > 1 && (
        <SeasonSwitch
          selectedId={selected.id}
          options={ctx.registrations.map((m) => ({ id: m.id, label: `${m.leagues.name} · ${m.colleges.name}` }))}
        />
      )}
      <Heading eyebrow={row.league_name ?? "Matiks College League"} title={row.college_name ?? "Your college"} />
      <StatusCard row={row} />
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

function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{eyebrow}</p>
      <h1 className="text-5xl sm:text-6xl">{title}</h1>
      {children && <p className="mt-3 max-w-xl text-foreground/85">{children}</p>}
    </div>
  );
}

const STATUS = {
  pending: { icon: ClockIcon, title: "Pending review", tone: "bg-status-pending text-status-pending-fg", text: "A Matiks admin will review your college soon. You can still edit the details below." },
  waitlisted: { icon: ClockIcon, title: "Waitlisted", tone: "bg-status-registration text-status-registration-fg", text: "You're on the waitlist. We'll let you know here if a spot opens up." },
  approved: { icon: CircleCheckIcon, title: "Approved", tone: "bg-status-live text-status-live-fg", text: "You're in! Add your winners in the Winners tab when the league ends." },
  rejected: { icon: XCircleIcon, title: "Denied", tone: "bg-destructive/15 text-destructive", text: "Fix the details below and resubmit, or message us in Chat." },
} as const;

function StatusCard({ row }: { row: OverviewRow }) {
  const s = STATUS[row.review_status!];
  return (
    <Glass className="relative flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
      {row.review_status === "pending" && (
        <EmptyStateSticker name="vault" className="absolute -top-3 right-3 mx-0 w-20 sm:static sm:order-last sm:w-24" />
      )}
      <CollegeLogo url={row.college_logo_url} name={row.college_name ?? "?"} className="size-14" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold", s.tone)}>
            <s.icon className="size-4" aria-hidden /> {s.title}
          </span>
          {row.review_status === "approved" && <StageBadge stage={(row.effective_stage ?? "registration_phase") as Stage}>{stageLine(row)}</StageBadge>}
        </div>
        <p className="text-sm text-foreground/85">{s.text}</p>
        {row.review_status === "rejected" && row.deny_reason && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm">
            <span className="font-semibold">Reason:</span> {row.deny_reason}
          </p>
        )}
      </div>
      <Button asChild variant="outline" className="h-11 rounded-full">
        <Link href="/college/chat">
          <MessageCircleIcon /> Chat with us
        </Link>
      </Button>
    </Glass>
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
