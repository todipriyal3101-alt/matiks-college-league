import { ArrowRightIcon, CalendarDaysIcon, GraduationCapIcon, SwordsIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Mascot } from "@/components/league/mascot";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";

import { LANDING } from "./content";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

// One hero, three fact cards, FAQ collapsed: only what helps someone decide to register.
export default async function HomePage() {
  const league = await getActiveLeague();
  const leagueName = league?.name ?? LANDING.fallbackLeagueName;
  const fmt = (d: string | null | undefined) => (d ? dateFormat.format(new Date(d)) : null);
  const deadline = fmt(league?.registration_deadline);
  // Only dates the season actually has; the card hides when there are none.
  const dates = [
    { label: "Registration closes", date: deadline },
    { label: "League starts", date: fmt(league?.start_date) },
    { label: "League ends", date: fmt(league?.end_date) },
  ].filter((d): d is { label: string; date: string } => d.date !== null);

  return (
    <div className="space-y-10 pb-24 sm:space-y-14 sm:pb-6">
      {/* Hero */}
      <section className="grid items-center gap-6 pt-2 sm:grid-cols-[1fr_auto] sm:pt-6">
        <div className="space-y-5 text-center sm:text-left">
          <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Matiks College League</p>
          <h1 className="text-[64px] sm:text-[112px]">{leagueName}</h1>
          <p className="mx-auto max-w-md text-lg text-muted-foreground sm:mx-0">{LANDING.tagline}</p>
          <dl className="mx-auto flex max-w-sm justify-center gap-3 sm:mx-0 sm:justify-start">
            <HeroFact label="Prize pool" value={LANDING.prizePool} />
            {deadline && <HeroFact label="Register by" value={deadline} />}
          </dl>
          <p className="text-sm text-muted-foreground">{LANDING.prizeNote}</p>
          <div className="hidden sm:block">
            <RegisterButton />
          </div>
        </div>
        <Mascot priority className="mx-auto size-40 sm:size-72" />
      </section>

      {/* Facts */}
      <section className={dates.length > 0 ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-2"}>
        <FactCard icon={SwordsIcon} title="Format">
          <ul className="space-y-1">
            {LANDING.format.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </FactCard>
        {dates.length > 0 && (
          <FactCard icon={CalendarDaysIcon} title="Dates">
            <dl className="space-y-1">
              {dates.map((d) => (
                <div key={d.label} className="flex justify-between gap-3">
                  <dt>{d.label}</dt>
                  <dd className="font-mono text-foreground">{d.date}</dd>
                </div>
              ))}
            </dl>
          </FactCard>
        )}
        <FactCard icon={GraduationCapIcon} title="Who can join">
          <ul className="space-y-1">
            {LANDING.whoCanJoin.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </FactCard>
      </section>

      {/* FAQ, collapsed */}
      <section className="space-y-3">
        <h2 className="text-4xl">FAQ</h2>
        <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4">
          {LANDING.faq.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="py-4 text-left text-base">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Phones: the Register button stays in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
        <RegisterButton />
      </div>
    </div>
  );
}

function HeroFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl border bg-card px-4 py-3 sm:flex-none">
      <dt className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="font-display text-2xl leading-tight text-primary sm:text-3xl">{value}</dd>
    </div>
  );
}

function FactCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-3xl border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-olive text-primary">
          <Icon className="size-5" />
        </span>
        <h2 className="text-3xl">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function RegisterButton() {
  return (
    <Button asChild size="lg" className="h-12 w-full px-8 text-base tracking-wide uppercase sm:w-auto">
      <Link href="/register">
        Register your college <ArrowRightIcon />
      </Link>
    </Button>
  );
}
