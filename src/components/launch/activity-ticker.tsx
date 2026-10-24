"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type ActivityItem = { kind: string; label: string; at: string };

const POLL_MS = 30_000;
const ROTATE_MS = 4_500;

function ago(at: string, now: number) {
  const min = Math.max(0, Math.round((now - new Date(at).getTime()) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

function line(item: ActivityItem, now: number | null) {
  if (item.kind === "approved") return <><b className="font-bold">{item.label} is in!</b></>;
  const fresh = now !== null && now - new Date(item.at).getTime() < 3_600_000;
  return <>A college from {item.label} {fresh ? "just registered" : "registered"}</>;
}

/**
 * "VIT Vellore is in! · 1 h ago" / "A college from Tamil Nadu just registered · 2 min ago" (public_activity_feed:
 * approved colleges by name, new ones by state, never people). Rotates one line at a time and polls /api/activity.
 * Times render only in the browser, so there's no hydration mismatch.
 */
export function ActivityTicker({ initial, className }: { initial: ActivityItem[]; className?: string }) {
  const [items, setItems] = useState(initial);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const rotate = setInterval(() => {
      setNow(Date.now());
      setIndex((i) => i + 1);
    }, ROTATE_MS);
    const poll = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/activity");
        if (res.ok) {
          const data = (await res.json()) as { items?: ActivityItem[] };
          if (data.items?.length) setItems(data.items);
        }
      } catch {
        // Offline: keep what we have.
      }
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(rotate);
      clearInterval(poll);
    };
  }, []);

  if (!items.length) return null;
  const item = items[index % items.length];

  return (
    <div className={cn("glass-surface flex min-h-11 items-center gap-2.5 overflow-hidden rounded-full px-4 py-2.5 text-sm", className)}>
      <span className="relative flex size-2 shrink-0" aria-hidden>
        <span className="absolute inset-0 animate-ping rounded-full bg-status-live-fg/60 motion-reduce:animate-none" />
        <span className="relative size-2 rounded-full bg-status-live-fg" />
      </span>
      <span className="sr-only">Live activity:</span>
      <p key={`${index}-${item.at}`} className="ticker-in min-w-0 truncate">
        {line(item, now)}
        {now !== null && <span className="text-muted-foreground"> · {ago(item.at, now)}</span>}
      </p>
    </div>
  );
}
