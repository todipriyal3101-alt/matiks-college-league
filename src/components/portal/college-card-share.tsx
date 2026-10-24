"use client";

import { DownloadIcon, ExternalLinkIcon, ImageIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Glass } from "@/components/glass";
import { Button } from "@/components/ui/button";

/** Approved colleges: the shareable card (LinkedIn post + Instagram story) and the public page. */
export function CollegeCardShare({ slug, collegeName }: { slug: string; collegeName: string }) {
  const [busy, setBusy] = useState(false);
  const post = `/c/${slug}/card?format=post`;

  // Phones share the image itself (WhatsApp, Instagram, LinkedIn apps); desktops fall back to the page link.
  async function shareImage() {
    setBusy(true);
    try {
      const url = `${location.origin}/c/${slug}`;
      const blob = await fetch(post).then((r) => r.blob());
      const file = new File([blob], `${slug}-matiks.png`, { type: "image/png" });
      const text = `${collegeName} is in the Matiks College League! 🧠⚡`;
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text, url });
      else if (navigator.share) await navigator.share({ text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Link copied. Download the image to post it.");
      }
    } catch {
    } finally {
      setBusy(false);
    }
  }

  return (
    <Glass className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-sans text-base font-bold normal-case">
          <ImageIcon className="size-4 text-primary" aria-hidden /> Your college card
        </h2>
        <Link href={`/c/${slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Public page <ExternalLinkIcon className="size-3.5" />
        </Link>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- generated card image */}
      <img src={post} alt={`${collegeName} is in the Matiks College League`} width={1200} height={627} loading="lazy" className="w-full rounded-2xl" />
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Button className="h-11 rounded-full" onClick={() => void shareImage()} disabled={busy}>
          {busy && <Loader2Icon className="animate-spin" />} Share
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full">
          <a href={`${post}&download=1`} download>
            <DownloadIcon /> LinkedIn post
          </a>
        </Button>
        <Button asChild variant="outline" className="h-11 rounded-full">
          <a href={`/c/${slug}/card?format=story&download=1`} download>
            <DownloadIcon /> Instagram story
          </a>
        </Button>
      </div>
    </Glass>
  );
}
