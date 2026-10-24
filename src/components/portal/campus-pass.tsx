"use client";

/* eslint-disable @next/next/no-img-element -- logos are user uploads; the QR is an inline SVG data URI */
import { BadgeCheckIcon, DownloadIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Logo } from "@/components/league/logo";
import { Button } from "@/components/ui/button";
import { seasonShortName } from "@/lib/league";
import { cn } from "@/lib/utils";

const STATUS = {
  pending: { label: "Pending review", tone: "bg-status-pending text-status-pending-fg" },
  waitlisted: { label: "Waitlisted", tone: "bg-status-registration text-status-registration-fg" },
  approved: { label: "Approved", tone: "bg-status-live text-status-live-fg" },
  rejected: { label: "Not approved", tone: "bg-destructive/15 text-destructive" },
} as const;

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const caps = words.filter((w) => w === w.toUpperCase() && w.length > 1);
  if (caps.length) return caps[0].slice(0, 4);
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "?";
}

/**
 * "Campus Lead Pass": a ticket with the POC's name, college, logos, season, status and a QR to /pass/CODE
 * (pending page with no people, then the college page once approved). Download as PNG or share.
 */
export function CampusPass({
  registrationId,
  name,
  college,
  season,
  status,
  verified,
  target,
  collegeLogoUrl,
  clubLogoUrl,
  code,
  qrSvg,
  url,
}: {
  registrationId: string;
  name: string;
  college: string;
  season: string;
  status: keyof typeof STATUS;
  verified: boolean;
  target: number | null;
  collegeLogoUrl: string | null;
  clubLogoUrl: string | null;
  code: string;
  qrSvg: string;
  url: string;
}) {
  const [sharing, setSharing] = useState(false);
  const image = `/college/pass/image?r=${registrationId}`;
  const s = STATUS[status];
  const short = seasonShortName(season);

  async function share() {
    setSharing(true);
    const text = status === "approved" ? `${college} is in the Matiks College League! I'm the Campus Lead.` : `I just registered ${college} for the Matiks College League as Campus Lead.`;
    try {
      const blob = await fetch(image).then((r) => (r.ok ? r.blob() : null));
      const file = blob ? new File([blob], "campus-lead-pass.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${text} ${url}` });
      else if (navigator.share) await navigator.share({ title: "Campus Lead Pass", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied");
      }
    } catch {
      // Share sheet closed.
    } finally {
      setSharing(false);
    }
  }

  return (
    <section aria-labelledby="pass-title" className="space-y-3">
      <div className="relative grid overflow-hidden rounded-[1.75rem] bg-[radial-gradient(circle_at_100%_0%,rgb(177_250_99/0.22),transparent_50%),radial-gradient(circle_at_0%_100%,rgb(184_167_245/0.22),transparent_50%),#171717] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.1),0_30px_60px_-30px_#000] sm:grid-cols-[1fr_11rem]">
        <div className="min-w-0 p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <Logo className="origin-left scale-90" />
            {short && <span className="font-display text-lg leading-none text-foreground/80">· {short}</span>}
          </div>
          <div className="mt-5 flex items-end gap-3">
            <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-sm font-extrabold text-background">
              {collegeLogoUrl ? <img src={collegeLogoUrl} alt="" className="size-full object-contain" /> : initials(college)}
            </span>
            {clubLogoUrl && <img src={clubLogoUrl} alt="" className="size-11 rounded-xl bg-white object-contain" />}
          </div>
          <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Campus Lead</p>
          <h2 id="pass-title" className="truncate text-5xl leading-none">
            {name}
          </h2>
          <p className="mt-1 font-bold">{college}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", s.tone)}>● {s.label}</span>
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-live px-3 py-1 text-xs font-bold text-status-live-fg">
                <BadgeCheckIcon className="size-3.5" aria-hidden /> Verified
              </span>
            )}
            {target && <span className="rounded-full bg-lilac/15 px-3 py-1 text-xs font-bold text-lilac">Target {target}</span>}
          </div>
        </div>
        <div className="relative flex items-center justify-between gap-4 border-t-2 border-dashed border-white/18 p-5 sm:flex-col sm:justify-center sm:border-t-0 sm:border-l-2">
          <span aria-hidden className="absolute -top-3 -left-3 size-6 rounded-full bg-background sm:left-[-13px]" />
          <span aria-hidden className="absolute -top-3 -right-3 size-6 rounded-full bg-background sm:top-auto sm:right-auto sm:-bottom-3 sm:left-[-13px]" />
          <img src={qrSvg} alt={`QR code to ${college}'s pass page`} width={112} height={112} className="size-28 rounded-xl bg-white p-1.5" />
          <span className="text-right sm:text-center">
            <span className="block font-mono text-[11px] text-muted-foreground">PASS</span>
            <span className="font-mono font-bold">MCL-{code.slice(0, 4).toUpperCase()}</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Button asChild className="h-12 rounded-full">
          <a href={`${image}&download=1`} download>
            <DownloadIcon /> Download PNG
          </a>
        </Button>
        <Button variant="outline" className="h-12 rounded-full" onClick={() => void share()} disabled={sharing}>
          {sharing ? <Loader2Icon className="animate-spin" /> : <Share2Icon />} Share pass
        </Button>
      </div>
    </section>
  );
}
