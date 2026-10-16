import { CalendarIcon, TrophyIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { getActiveLeague } from "@/lib/data/leagues";

import { LANDING } from "./content";

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

export default async function HomePage() {
  const league = await getActiveLeague();
  const leagueName = league?.name ?? LANDING.fallbackLeagueName;

  const timeline = LANDING.timeline.map((item, i) =>
    i === 0 && league?.registration_deadline
      ? { ...item, date: dateFormat.format(new Date(league.registration_deadline)) }
      : item,
  );

  return (
    <div className="space-y-14 pb-8">
      {/* Hero */}
      <section className="relative isolate space-y-5 pt-6 text-center sm:pt-12">
        <div
          aria-hidden
          className="bg-aurora pointer-events-none absolute -top-24 -bottom-16 left-1/2 -z-10 w-[min(100vw,72rem)] -translate-x-1/2 opacity-70 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]"
        />
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Matiks College League</p>
        <h1 className="font-display text-5xl font-bold sm:text-7xl">{leagueName}</h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">{LANDING.tagline}</p>
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm">
          <TrophyIcon className="size-4 text-primary" />
          Prize pool: <strong className="font-mono">{LANDING.prizePool}</strong>
        </div>
        <div>
          <RegisterButton />
        </div>
      </section>

      {/* Format */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Format</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {LANDING.format.map((point) => (
            <li key={point} className="rounded-xl border bg-card p-4 text-sm">
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Key dates</h2>
        <ol className="space-y-3">
          {timeline.map((item) => (
            <li key={item.label} className="flex items-center gap-3 rounded-xl border bg-card p-4">
              <CalendarIcon className="size-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="font-mono text-sm text-muted-foreground">{item.date}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Who can join */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">Who can join</h2>
        <ul className="space-y-2">
          {LANDING.whoCanJoin.map((line) => (
            <li key={line} className="flex gap-3 text-sm">
              <UsersIcon className="size-4 shrink-0 translate-y-0.5 text-primary" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* TODO: "Past highlights" section (SPEC) once we have photos/results from earlier seasons. */}

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="font-display text-2xl font-bold">FAQ</h2>
        <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
          {LANDING.faq.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Closing CTA */}
      <section className="glow space-y-4 rounded-2xl border border-primary/30 bg-card p-6 text-center">
        <h2 className="font-display text-2xl font-bold">Ready to represent your college?</h2>
        <RegisterButton />
      </section>
    </div>
  );
}

function RegisterButton() {
  return (
    <Button asChild size="lg" className="glow h-12 w-full px-8 text-base sm:w-auto">
      <Link href="/register">Register your college</Link>
    </Button>
  );
}
