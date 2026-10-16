"use client";

import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ShareButtons({ url, message }: { url: string; message: string }) {
  const text = `${message} ${url}`;
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      label: "X",
      href: `https://x.com/intent/post?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy it.");
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {links.map((l) => (
        <Button key={l.label} asChild variant="outline" className="h-11">
          <a href={l.href} target="_blank" rel="noopener noreferrer">
            {l.label}
          </a>
        </Button>
      ))}
      <Button type="button" variant="outline" className="h-11" onClick={copy}>
        <CopyIcon /> Copy link
      </Button>
    </div>
  );
}
