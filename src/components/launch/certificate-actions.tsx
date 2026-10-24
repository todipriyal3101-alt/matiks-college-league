"use client";

import { ClipboardCopyIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addToProfileUrl, certificatePostText, shareOnLinkedInUrl } from "@/lib/linkedin";

/** The LinkedIn "in" mark (lucide no longer ships brand icons). */
function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Add to LinkedIn profile · Share on LinkedIn (+ Copy post text) · PNG / PDF. */
export function CertificateActions({ id, issuedAt, college, season, url }: { id: string; issuedAt: string; college: string; season: string; url: string }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <Button asChild className="h-12 rounded-full bg-[#0a66c2] text-white shadow-[0_4px_0_#074b8f] hover:brightness-110 sm:col-span-2">
        <a href={addToProfileUrl({ id, issuedAt, certUrl: url })} target="_blank" rel="noopener">
          <LinkedinIcon /> Add to LinkedIn profile
        </a>
      </Button>
      <Button asChild variant="outline" className="h-11 rounded-full">
        <a href={shareOnLinkedInUrl(url)} target="_blank" rel="noopener">
          <Share2Icon /> Share on LinkedIn
        </a>
      </Button>
      <Button
        variant="outline"
        className="h-11 rounded-full"
        onClick={() =>
          void navigator.clipboard
            .writeText(certificatePostText({ college, season, url }))
            .then(() => toast.success("Post text copied: paste it into your LinkedIn post"))
        }
      >
        <ClipboardCopyIcon /> Copy post text
      </Button>
      <Button asChild variant="outline" className="h-11 rounded-full">
        <a href={`/certificate/${id}/image?download=1`} download>
          <DownloadIcon /> Download PNG
        </a>
      </Button>
      <Button asChild variant="outline" className="h-11 rounded-full">
        <a href={`/certificate/${id}/image?format=pdf`} download>
          <DownloadIcon /> Download PDF
        </a>
      </Button>
    </div>
  );
}
