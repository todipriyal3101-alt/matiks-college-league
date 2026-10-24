"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { CELEBRATE_EVENT } from "@/lib/events";

import mascot from "../../../public/brand/mascot.webp";

/**
 * The Matiks mascot (public pages only). It's one flat image, so it "looks" by leaning and tilting toward the
 * cursor/finger, waves on hover and jumps on CELEBRATE_EVENT. All of it off with prefers-reduced-motion.
 */
export function InteractiveMascot({ className, priority }: { className?: string; priority?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lean, setLean] = useState({ x: 0, r: 0 });
  const [jump, setJump] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = ref.current?.getBoundingClientRect();
        if (!box) return;
        const dx = (e.clientX - (box.left + box.width / 2)) / window.innerWidth;
        const dy = (e.clientY - (box.top + box.height / 2)) / window.innerHeight;
        setLean({ x: Math.max(-1, Math.min(1, dx)) * 14, r: Math.max(-1, Math.min(1, dx + dy * 0.3)) * 7 });
      });
    };
    const onCelebrate = () => {
      setJump(true);
      setTimeout(() => setJump(false), 900);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
    };
  }, []);

  return (
    <div ref={ref} className={className} aria-hidden>
      <div className={jump ? "mascot-jump" : undefined}>
        <div className="mascot-wave transition-transform duration-300 ease-out" style={{ transform: `translateX(${lean.x}px) rotate(${lean.r}deg)` }}>
          <Image src={mascot} alt="" priority={priority} sizes="(max-width: 640px) 220px, 340px" className="h-auto w-full select-none" draggable={false} />
        </div>
      </div>
    </div>
  );
}
