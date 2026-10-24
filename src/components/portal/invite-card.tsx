"use client";

import { CopyIcon, LinkIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Glass } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The POC's personal invite link (/i/CODE) + how many people came through it. */
export function InviteCard({
  code,
  plays,
  registrations,
  collegeName,
  highlight = false,
}: {
  code: string;
  plays: number;
  registrations: number;
  collegeName: string;
  highlight?: boolean;
}) {
  const url = typeof window === "undefined" ? `/i/${code}` : `${window.location.origin}/i/${code}`;
  const people = plays + registrations;
  const text = `${collegeName} is in the Matiks College League! Take the 30-second math duel and help us unlock a bigger prize pool:`;

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Matiks College League", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copied! Paste it in your WhatsApp groups.");
      }
    } catch {}
  }

  return (
    <Glass className={cn("space-y-3 p-5 sm:p-6", highlight && "shadow-[inset_0_0_0_1px_rgb(177_250_99/0.35),var(--glass-edge),var(--glass-drop)]")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-base font-bold normal-case">
            <LinkIcon className="size-4 text-primary" aria-hidden /> Your invite link
          </h2>
          <p className="text-sm text-muted-foreground">Share it with batchmates. Everyone who plays or registers through it counts for you.</p>
        </div>
        <p className="rounded-2xl bg-olive px-3 py-1.5 text-sm font-bold text-primary">
          {people} {people === 1 ? "person" : "people"} joined via your link
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-black/25 p-1.5 pl-3.5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]">
        <span className="min-w-0 flex-1 truncate font-mono text-sm">{url}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-full"
          aria-label="Copy invite link"
          onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}
        >
          <CopyIcon />
        </Button>
        <Button type="button" className="h-9 rounded-full px-4" onClick={() => void share()}>
          <Share2Icon /> Share
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {plays} duel {plays === 1 ? "play" : "plays"} · {registrations} {registrations === 1 ? "college" : "colleges"} registered · 5+ earns the Recruiter badge
      </p>
    </Glass>
  );
}
