"use client";

import { Loader2Icon, Volume2Icon, VolumeXIcon, ZapIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CollegeSearch } from "@/components/college-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confetti } from "@/lib/confetti";
import type { CollegeSearchResult } from "@/lib/data/colleges";
import { DUEL_MS, questions, type Answer, type Question } from "@/lib/duel/engine";
import { CELEBRATE_EVENT } from "@/lib/events";
import { cn } from "@/lib/utils";

const PB_KEY = "mcl_duel_pb";
const SOUND_KEY = "mcl_duel_sound";
const APP_URL = process.env.NEXT_PUBLIC_MATIKS_APP_URL || "https://www.matiks.com";

type Result = { score: number; correct: number; attempted: number; bestCombo: number; rank: number; personalBest: boolean };

function readPb() {
  try {
    return Number(localStorage.getItem(PB_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** A short beep (only when the player turned sound on). */
function beep(ctx: AudioContext | null, ok: boolean) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = ok ? 880 : 220;
  g.gain.setValueAtTime(0.06, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + 0.13);
}

/**
 * The 30-second mental-math duel. The server issues a signed round (seed + expiry), the questions come from the
 * seed, and the server re-scores the answers + timings, so the score can't be faked from the browser.
 */
export function DuelGame({
  rival = "IIT Bombay",
  beat,
  compact = false,
}: {
  /** "Think your college can beat …?" */
  rival?: string;
  /** From an invite link: the score to beat. */
  beat?: number | null;
  /** Home page embed: a little tighter. */
  compact?: boolean;
}) {
  const [phase, setPhase] = useState<"intro" | "loading" | "playing" | "scoring" | "result">("intro");
  const [token, setToken] = useState<string | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [combo, setCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(DUEL_MS);
  const [flash, setFlash] = useState<"ok" | "no" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Client-only component (loaded with ssr: false), so localStorage is there. Sound is off unless turned on.
  const [sound, setSound] = useState(() => {
    try {
      return localStorage.getItem(SOUND_KEY) === "on";
    } catch {
      return false;
    }
  });
  const answers = useRef<Answer[]>([]);
  const startedAt = useRef(0);
  const audio = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    setPhase("loading");
    const res = await fetch("/api/duel/start", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      toast.error(data.error ?? "Couldn't start. Check your connection.");
      setPhase("intro");
      return;
    }
    if (sound && !audio.current) audio.current = new AudioContext();
    answers.current = [];
    setToken(data.token);
    setQs(questions(data.seed));
    setIndex(0);
    setTyped("");
    setCombo(0);
    setCorrect(0);
    setLeft(DUEL_MS);
    setResult(null);
    startedAt.current = performance.now();
    setPhase("playing");
  }, [sound]);

  const finish = useCallback(async () => {
    setPhase("scoring");
    const res = await fetch("/api/duel/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, answers: answers.current }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      toast.error(data.error ?? "Couldn't score that round.");
      setPhase("intro");
      return;
    }
    const pb = readPb();
    const personalBest = data.score > pb && data.score > 0;
    if (personalBest) {
      try {
        localStorage.setItem(PB_KEY, String(data.score));
      } catch {}
      setTimeout(() => confetti(), 150);
    }
    setResult({ ...data, personalBest });
    setPhase("result");
    window.dispatchEvent(new Event(CELEBRATE_EVENT)); // the home page mascot cheers
  }, [token]);

  // Timer.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const remaining = Math.max(0, DUEL_MS - (performance.now() - startedAt.current));
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        void finish();
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase, finish]);

  const submit = useCallback(() => {
    if (phase !== "playing" || typed === "") return;
    const t = Math.round(performance.now() - startedAt.current);
    const prev = answers.current.at(-1)?.t ?? 0;
    if (t < prev + 260) return; // human pace (the server checks the same)
    const value = Number(typed);
    answers.current.push({ i: index, a: value, t });
    const ok = value === qs[index].answer;
    beep(audio.current, ok);
    setFlash(ok ? "ok" : "no");
    setTimeout(() => setFlash(null), 180);
    if (ok) {
      setCorrect((c) => c + 1);
      setCombo((c) => c + 1);
    } else setCombo(0);
    setIndex((i) => i + 1);
    setTyped("");
  }, [phase, typed, index, qs]);

  const press = useCallback(
    (key: string) => {
      if (phase !== "playing") return;
      if (key === "⌫") setTyped((v) => v.slice(0, -1));
      else if (key === "↵") submit();
      else setTyped((v) => (v.length < 6 ? v + key : v));
    },
    [phase, submit],
  );

  // Keyboard: digits, Backspace, Enter.
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("⌫");
      else if (e.key === "Enter") press("↵");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, press]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    if (next && !audio.current) audio.current = new AudioContext();
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {}
  }

  if (phase === "result" && result && token) {
    return <DuelResult result={result} token={token} rival={rival} beat={beat ?? null} onAgain={start} />;
  }

  const q = qs[index];
  return (
    <div className={cn("glass-surface space-y-4 rounded-3xl p-4 sm:p-5", compact && "sm:p-4")}>
      <div className="flex items-center justify-between text-sm font-bold">
        <span>
          Score <span className="font-mono text-primary">{correct}</span>
          {combo >= 2 && <span className="ml-2 rounded-full bg-olive px-2 py-0.5 text-xs text-primary">🔥 ×{combo}</span>}
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
            00:{String(Math.ceil(left / 1000)).padStart(2, "0")}
          </span>
          <button type="button" onClick={toggleSound} className="grid size-8 place-items-center rounded-full hover:bg-white/8" aria-label={sound ? "Sound off" : "Sound on"}>
            {sound ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4 text-muted-foreground" />}
          </button>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#e8ff9c] transition-[width] duration-100 ease-linear" style={{ width: `${(left / DUEL_MS) * 100}%` }} />
      </div>

      {phase === "playing" && q ? (
        <>
          <p
            className={cn(
              "py-3 text-center font-display text-6xl leading-none tabular-nums transition-colors sm:text-7xl",
              flash === "ok" && "text-primary",
              flash === "no" && "duel-shake text-destructive",
            )}
            aria-live="polite"
          >
            {q.text} = <span className="text-primary">{typed || "?"}</span>
          </p>
          <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Answer pad">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "↵"].map((k) => (
              <button
                key={k}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  press(k);
                }}
                onKeyDown={(e) => e.key === " " && press(k)}
                aria-label={k === "⌫" ? "Delete" : k === "↵" ? "Submit answer" : k}
                className={cn(
                  "h-14 rounded-2xl font-mono text-2xl font-bold shadow-[inset_0_1px_0_rgb(255_255_255/0.1)] transition-transform select-none active:scale-95 sm:h-15",
                  k === "↵" ? "bg-primary text-primary-foreground" : "bg-white/6 hover:bg-white/10",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-4 py-6 text-center">
          <p className="font-display text-5xl leading-none">{beat ? `Beat ${beat}` : "30 seconds. Go!"}</p>
          <p className="text-sm text-muted-foreground">Questions get harder. Type or tap, Enter to answer. No sign-up.</p>
          <Button className="h-12 rounded-full px-7 text-base" onClick={() => void start()} disabled={phase !== "intro"}>
            {phase === "intro" ? <ZapIcon /> : <Loader2Icon className="animate-spin" />}
            {phase === "scoring" ? "Scoring…" : phase === "loading" ? "Starting…" : "Start the duel"}
          </Button>
        </div>
      )}
    </div>
  );
}

function DuelResult({ result, token, rival, beat, onAgain }: { result: Result; token: string; rival: string; beat: number | null; onAgain: () => void }) {
  const [name, setName] = useState("");
  const [college, setCollege] = useState<CollegeSearchResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<"save" | "invite" | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const accuracy = result.attempted ? Math.round((result.correct / result.attempted) * 100) : 0;

  async function claim(invite: boolean) {
    setBusy(invite ? "invite" : "save");
    const res = await fetch("/api/duel/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: name || undefined, collegeId: college?.id ?? null, invite }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      toast.error(data.error ?? "Couldn't save.");
      return null;
    }
    if (name || college) setSaved(true);
    return data as { code: string | null };
  }

  async function share(url: string, text: string) {
    try {
      if (navigator.share) await navigator.share({ title: "Matiks College League", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copied! Paste it anywhere.");
      }
    } catch {}
  }

  async function challenge() {
    const url = inviteUrl ?? (await claim(true).then((d) => (d?.code ? `${location.origin}/i/${d.code}` : null)));
    if (!url) return;
    setInviteUrl(url);
    await share(url, `I scored ${result.score} in the 30-second Matiks math duel. Beat me 👉`);
  }

  return (
    <div className="glass-surface space-y-4 rounded-3xl p-5 text-center sm:p-6" aria-live="polite">
      {result.personalBest && <span className="inline-flex rounded-full bg-olive px-3 py-1 text-sm font-bold text-primary">🎉 New personal best</span>}
      {beat != null && (
        <p className="text-sm font-semibold">{result.score > beat ? `You beat ${beat}! 🏆` : result.score === beat ? `Tied at ${beat}!` : `${beat - result.score} short of ${beat}. Again?`}</p>
      )}
      <div>
        <p className="font-display text-[7rem] leading-[0.85] text-primary">{result.score}</p>
        <p className="font-semibold">correct in 30 seconds</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[
          ["×" + result.bestCombo, "best combo"],
          [accuracy + "%", "accuracy"],
          ["#" + result.rank, "today"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-white/5 p-2.5">
            <dt className="sr-only">{l}</dt>
            <dd className="font-mono text-lg font-bold">{v}</dd>
            <dd className="text-xs text-muted-foreground">{l}</dd>
          </div>
        ))}
      </dl>

      <h3 className="font-display text-3xl leading-none font-normal uppercase">Think your college can beat {rival}?</h3>
      {saved ? (
        <p className="text-sm text-primary">You&apos;re on today&apos;s board{name ? `, ${name.split(" ")[0]}` : ""}!</p>
      ) : (
        <div className="space-y-2 text-left">
          <p className="text-center text-xs text-muted-foreground">Rep your college on today&apos;s board (first name only, optional).</p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" maxLength={24} autoComplete="given-name" className="h-12" aria-label="Your first name" />
          <CollegeSearch id="duel-college" selectedId={college?.id ?? null} selectedLabel={college?.name ?? ""} onSelect={setCollege} placeholder="Your college" />
          <Button variant="outline" className="h-11 w-full rounded-full" disabled={busy !== null || (!name && !college)} onClick={() => void claim(false)}>
            {busy === "save" && <Loader2Icon className="animate-spin" />} Put me on the board
          </Button>
        </div>
      )}

      <div className="grid gap-2.5">
        <Button className="h-12 rounded-full text-base" disabled={busy !== null} onClick={() => void challenge()}>
          {busy === "invite" && <Loader2Icon className="animate-spin" />} Challenge a friend
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="outline" className="h-11 rounded-full" onClick={() => void share(inviteUrl ?? `${location.origin}/duel`, `I scored ${result.score} in the 30-second Matiks math duel. Can you beat it?`)}>
            Share score
          </Button>
          <Button variant="outline" className="h-11 rounded-full" onClick={onAgain}>
            Play again
          </Button>
        </div>
        <Button asChild variant="outline" className="h-11 rounded-full">
          <Link href="/login?mode=signup">Register your college →</Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Play real duels on the{" "}
        <a href={APP_URL} target="_blank" rel="noopener" className="font-semibold text-primary underline-offset-4 hover:underline">
          Matiks app ↗
        </a>
      </p>
    </div>
  );
}
