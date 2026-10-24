import { ArrowRightIcon, ChevronDownIcon, ZapIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DuelLoader } from "@/components/duel/duel-loader";
import { Glass } from "@/components/glass";
import { CollegeRace } from "@/components/launch/college-race";
import { Countdown } from "@/components/launch/countdown";
import { InteractiveMascot } from "@/components/launch/interactive-mascot";
import { TopToday } from "@/components/launch/top-today";
import { Sticker } from "@/components/stickers";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCollegeRace, getHomeStats } from "@/lib/data/public";
import { formatINR, PRIZE_TIERS } from "@/lib/league";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: { absolute: "Matiks College League · Your college vs every college" },
  description: "The inter-college mind sports league by Matiks. Play a 30-second math duel, rally your campus and unlock up to ₹10,000.",
};

const STEPS = [
  { n: "1", title: "Register your college", body: "Create an account and tell us your college and league dates. A Matiks admin approves it." },
  { n: "2", title: "Rally your batch", body: "Share your invite link and the 30-second duel. More players unlock a bigger prize pool." },
  { n: "3", title: "Play and win", body: "Run your league on the Matiks app, add your winners and we pay the prizes." },
];

const FAQ = [
  { q: "What is the Matiks College League?", a: "An inter-college mind sports league by Matiks: colleges compete on the Matiks app, and the prize pool grows with each college's turnout." },
  { q: "Who can register a college?", a: "Any student or staff member who wants to lead it (we call them the Campus Lead). Create an account, register your college, and a Matiks admin approves it, usually within a day." },
  { q: "Does it cost anything?", a: "No. Registering and playing are free." },
  { q: "How does the prize pool work?", a: `It grows with your college's players: ${[...PRIZE_TIERS].reverse().map((t) => (t.min ? `${t.min}+ → ${formatINR(t.amount)}` : `any turnout → ${formatINR(t.amount)}`)).join(" · ")}.` },
  { q: "When does the league start?", a: "Each college picks its own league dates when registering." },
  { q: "Do I need the Matiks app?", a: "The 30-second duel here needs nothing. League matches are played on the Matiks app." },
];

export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-28">
      {/* Hero */}
      <section className="grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Suspense fallback={<p className="h-4" />}>
            <Eyebrow />
          </Suspense>
          <h1 className="text-6xl sm:text-8xl">
            Your college
            <br />
            vs <span className="text-primary">every</span>
            <br />
            college.
          </h1>
          <p className="max-w-lg text-lg text-foreground/85">
            The inter-college mind sports league by Matiks. Rally your campus, climb the race, unlock up to {formatINR(PRIZE_TIERS[0].amount)}.
          </p>
          <Suspense fallback={<Skeleton className="h-20 w-80 rounded-2xl" />}>
            <NextStart />
          </Suspense>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Suspense fallback={<RegisterButton signedIn={false} />}>
              <HeroCta />
            </Suspense>
            <Button asChild variant="outline" className="h-13 rounded-full px-6 text-base">
              <Link href="#duel">
                <ZapIcon /> Play a 30-sec duel
              </Link>
            </Button>
          </div>
          <Suspense fallback={null}>
            <Turnout />
          </Suspense>
        </div>
        <div className="relative mx-auto h-64 w-full max-w-sm sm:h-[26rem] lg:max-w-none">
          <Glass className="absolute top-2 left-0 z-10 max-w-52 rounded-[1.25rem] rounded-bl-md px-4 py-3 text-sm font-bold sm:top-8">
            Psst… bet you can&apos;t beat 14 in 30 seconds.
          </Glass>
          <InteractiveMascot priority className="absolute right-2 bottom-0 w-52 sm:right-8 sm:w-80" />
          <Sticker name="trophy" className="sticker-wobble absolute bottom-0 left-4 h-auto w-24 sm:w-36" style={{ "--tilt": "-8deg" } as React.CSSProperties} />
        </div>
      </section>

      {/* Mini duel */}
      <section id="duel" className="scroll-mt-24">
        <Glass className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Mini duel · no sign-up</p>
            <h2 className="text-5xl sm:text-6xl">30 seconds. How many can you solve?</h2>
            <p className="text-foreground/85">Questions get harder. Build a combo. Then challenge your batchmates with your own link.</p>
            <Suspense fallback={<Skeleton className="h-60 w-full rounded-3xl" />}>
              <TopToday limit={5} />
            </Suspense>
          </div>
          <Suspense fallback={<Skeleton className="h-[25rem] w-full rounded-3xl" />}>
            <HomeDuel />
          </Suspense>
        </Glass>
      </section>

      {/* College race */}
      <section id="race" className="scroll-mt-24">
        <Suspense fallback={<Skeleton className="h-[30rem] w-full rounded-3xl" />}>
          <Race />
        </Suspense>
      </section>

      {/* Prize tiers */}
      <section id="prizes" className="scroll-mt-24 space-y-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Prize pool grows with your turnout</p>
          <h2 className="text-5xl sm:text-6xl">Bring more players, unlock more</h2>
        </div>
        <ol className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[...PRIZE_TIERS].reverse().map((t, i, all) => (
            <Glass asChild key={t.min} className={i === all.length - 1 ? "shadow-[inset_0_0_0_1px_rgb(177_250_99/0.4),var(--glass-edge),var(--glass-drop)]" : undefined}>
              <li className="p-5">
                <span className="block font-display text-5xl text-primary">{formatINR(t.amount)}</span>
                <span className="text-foreground/85">{t.min ? `${t.min}+ players` : "Any turnout"}</span>
              </li>
            </Glass>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">India. USA prize pools are set per college.</p>
      </section>

      {/* How it works */}
      <section className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">How it works</p>
          <h2 className="text-5xl sm:text-6xl">Three steps</h2>
        </div>
        <ol className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <Glass asChild key={s.n}>
              <li className="space-y-2 p-5 sm:p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-olive font-display text-2xl text-primary">{s.n}</span>
                <h3 className="text-lg">{s.title}</h3>
                <p className="text-sm text-foreground/85">{s.body}</p>
              </li>
            </Glass>
          ))}
        </ol>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 space-y-5">
        <h2 className="text-5xl sm:text-6xl">FAQ</h2>
        <Glass className="divide-y divide-white/8 p-2 sm:p-3">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-3 py-4 font-semibold hover:bg-white/4 [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <p className="px-3 pb-4 text-foreground/85">{f.a}</p>
            </details>
          ))}
        </Glass>
        <div className="flex justify-center pt-4">
          <Suspense fallback={<RegisterButton signedIn={false} />}>
            <HeroCta />
          </Suspense>
        </div>
      </section>
    </div>
  );
}

async function Eyebrow() {
  const stats = await getHomeStats();
  return (
    <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
      {[stats.season, "India + USA", "Free to enter"].filter(Boolean).join(" · ")}
    </p>
  );
}

async function NextStart() {
  const stats = await getHomeStats();
  return <Countdown date={stats.next_league_start} />;
}

async function Turnout() {
  const stats = await getHomeStats();
  if (!stats.colleges) return null;
  const n = new Intl.NumberFormat("en-IN");
  return (
    <p className="text-sm text-muted-foreground">
      {n.format(stats.colleges)} {stats.colleges === 1 ? "college" : "colleges"} · {n.format(stats.players)} players already in
    </p>
  );
}

/** Signed in: "Go to dashboard" instead of Register (no redirect from "/"). */
async function HeroCta() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return <RegisterButton signedIn={!!data?.claims.sub} />;
}

function RegisterButton({ signedIn }: { signedIn: boolean }) {
  return (
    <Button asChild className="h-13 rounded-full px-7 text-base">
      <Link href={signedIn ? "/auth/continue" : "/login?mode=signup"}>
        {signedIn ? "Go to dashboard" : "Register your college"} <ArrowRightIcon />
      </Link>
    </Button>
  );
}

async function HomeDuel() {
  const leader = (await getCollegeRace("india"))[0];
  return <DuelLoader compact rival={leader?.name ?? "IIT Bombay"} />;
}

async function Race() {
  const [india, usa] = await Promise.all([getCollegeRace("india"), getCollegeRace("usa")]);
  return <CollegeRace data={{ india, usa }} />;
}
