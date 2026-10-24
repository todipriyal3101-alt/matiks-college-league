"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

// The game's code loads only when its spot scrolls into view (or straight away on /duel), so the home page stays fast.
const DuelGame = dynamic(() => import("@/components/duel/duel-game").then((m) => m.DuelGame), {
  ssr: false,
  loading: () => <Skeleton className="h-[25rem] w-full rounded-3xl" />,
});

export function DuelLoader({ eager = false, ...props }: { eager?: boolean; rival?: string; beat?: number | null; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(eager);
  useEffect(() => {
    if (show || !ref.current) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setShow(true), { rootMargin: "300px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [show]);
  return <div ref={ref}>{show ? <DuelGame {...props} /> : <Skeleton className="h-[25rem] w-full rounded-3xl" />}</div>;
}
