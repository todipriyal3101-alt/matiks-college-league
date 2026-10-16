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
      <section className="space-y-5 pt-4 text-center sm:pt-10">
        <p className="text-sm font-medium tracking-wide text-brand-accent uppercase">
          Matiks College League
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-brand sm:text-6xl">{leagueName}</h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">{LANDING.tagline}</p>
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
          <TrophyIcon className="size-4 text-brand-accent" />
          Prize pool: <strong>{LANDING.prizePool}</strong>
        </div>
        <div>
          <RegisterButton />
        </div>
      </section>

      {/* Format */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Format</h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {LANDING.format.map((point) => (
            <li key={point} className="rounded-xl border p-4 text-sm">
              {point}
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Key dates</h2>
        <ol className="space-y-3">
          {timeline.map((item) => (
            <li key={item.label} className="flex items-center gap-3 rounded-xl border p-4">
              <CalendarIcon className="size-5 shrink-0 text-brand-accent" />
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.date}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Who can join */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Who can join</h2>
        <ul className="space-y-2">
          {LANDING.whoCanJoin.map((line) => (
            <li key={line} className="flex gap-3 text-sm">
              <UsersIcon className="size-4 shrink-0 translate-y-0.5 text-brand-accent" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* TODO: "Past highlights" section (SPEC) once we have photos/results from earlier seasons. */}

      {/* FAQ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">FAQ</h2>
        <Accordion type="single" collapsible className="rounded-xl border px-4">
          {LANDING.faq.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Closing CTA */}
      <section className="space-y-4 rounded-2xl border p-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Ready to represent your college?</h2>
        <RegisterButton />
      </section>
    </div>
  );
}

function RegisterButton() {
  return (
    <Button asChild size="lg" className="h-12 w-full bg-brand px-8 text-base sm:w-auto">
      <Link href="/register">Register your college</Link>
    </Button>
  );
}
