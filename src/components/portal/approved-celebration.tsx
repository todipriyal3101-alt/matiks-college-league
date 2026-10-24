"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Sticker } from "@/components/stickers";
import { confetti } from "@/lib/confetti";

const approvedKey = (id: string) => `mcl_approved_seen_${id}`;

/** The first time this device sees "Approved": confetti, a big trophy and a toast (once per device). */
export function ApprovedCelebration({ registrationId, college }: { registrationId: string; college: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(approvedKey(registrationId));
      if (!seen) localStorage.setItem(approvedKey(registrationId), "1");
    } catch {}
    if (seen) return;
    const start = setTimeout(() => {
      setShow(true);
      confetti({ count: 200 });
      toast.success(`You're approved! 🎉 ${college} is in the league.`);
    }, 300);
    const end = setTimeout(() => setShow(false), 3200);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
  }, [registrationId, college]);

  if (!show) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 grid place-items-center">
      <Sticker name="trophy" eager className="pop-in h-auto w-64 sm:w-80" style={{ "--tilt": "-6deg" } as React.CSSProperties} />
    </div>
  );
}
