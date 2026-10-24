"use client";

import { CopyIcon, MessageCircleIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { shareOnLinkedInUrl } from "@/lib/linkedin";

/** Share · LinkedIn · WhatsApp · Copy link (public pages). */
export function ShareRow({ url, text }: { url: string; text: string }) {
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "Matiks College League", text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copied!");
      }
    } catch {}
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button className="h-11 rounded-full px-5" onClick={() => void share()}>
        <Share2Icon /> Share
      </Button>
      <Button asChild variant="outline" className="h-11 rounded-full">
        <a href={shareOnLinkedInUrl(url)} target="_blank" rel="noopener">
          LinkedIn
        </a>
      </Button>
      <Button asChild variant="outline" className="h-11 rounded-full">
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener">
          <MessageCircleIcon /> WhatsApp
        </a>
      </Button>
      <Button variant="outline" className="h-11 rounded-full" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}>
        <CopyIcon /> Copy link
      </Button>
    </div>
  );
}
