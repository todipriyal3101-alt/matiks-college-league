"use client";

import { AwardIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setCertificateHidden } from "@/app/college/actions";
import { Glass } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { addToProfileUrl } from "@/lib/linkedin";
import { cn } from "@/lib/utils";

type Cert = { id: string; recipient_name: string; issued_at: string; hidden: boolean };

/** Approved colleges: one Campus Lead certificate per contact, with LinkedIn + a hide switch. */
export function CertificatesCard({ certificates, siteUrl }: { certificates: Cert[]; siteUrl: string }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [, start] = useTransition();
  if (!certificates.length) return null;

  return (
    <Glass className="space-y-3 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-sans text-base font-bold normal-case">
        <AwardIcon className="size-4 text-primary" aria-hidden /> Campus Lead certificates
      </h2>
      <p className="text-sm text-muted-foreground">Add it to your LinkedIn profile under Licenses &amp; certifications. Anyone can verify it from its link.</p>
      <ul className="space-y-2">
        {certificates.map((c) => {
          const isHidden = hidden[c.id] ?? c.hidden;
          const url = `${siteUrl}/certificate/${c.id}`;
          return (
            <li key={c.id} className={cn("glass-surface flex flex-wrap items-center gap-3 rounded-2xl p-3", isHidden && "opacity-70")}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{c.recipient_name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{c.id}</span>
              </span>
              {!isHidden && (
                <>
                  <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                    <Link href={`/certificate/${c.id}`} target="_blank">
                      View <ExternalLinkIcon />
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="h-9 rounded-full bg-[#0a66c2] text-white shadow-[0_3px_0_#074b8f]">
                    <a href={addToProfileUrl({ id: c.id, issuedAt: c.issued_at, certUrl: url })} target="_blank" rel="noopener">
                      Add to LinkedIn
                    </a>
                  </Button>
                </>
              )}
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Hide
                <Switch
                  checked={isHidden}
                  aria-label={`Hide ${c.recipient_name}'s certificate`}
                  onCheckedChange={(v) => {
                    setHidden((h) => ({ ...h, [c.id]: v }));
                    start(async () => {
                      const res = await setCertificateHidden(c.id, v);
                      if (!res.ok) {
                        setHidden((h) => ({ ...h, [c.id]: !v }));
                        toast.error(res.error);
                      } else toast.success(v ? "Hidden: the verify page now says it isn't available" : "Visible again");
                    });
                  }}
                />
              </label>
            </li>
          );
        })}
      </ul>
    </Glass>
  );
}
