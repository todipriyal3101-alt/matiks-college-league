"use client";

import { MegaphoneIcon, PencilIcon, PlusIcon, QrCodeIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { setAmbassadorActive } from "@/app/admin/(panel)/ambassadors/actions";
import { CopyButton } from "@/components/league/copy-button";
import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { AmbassadorDialog, type AmbassadorFormValues } from "./ambassador-dialog";
import { QrDialog } from "./qr-dialog";

export type AmbassadorRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  college: { id: string; name: string } | null;
  code: string;
  active: boolean;
  signupsSeason: number;
  signupsTotal: number;
};

export function AmbassadorsList({
  ambassadors,
  siteUrl,
  seasonName,
  isWriter,
}: {
  ambassadors: AmbassadorRow[];
  siteUrl: string;
  seasonName: string;
  isWriter: boolean;
}) {
  const [editing, setEditing] = useState<AmbassadorFormValues | null>(null);
  const [qr, setQr] = useState<AmbassadorRow | null>(null);
  const [activeOverride, setActiveOverride] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const link = (code: string) => `${siteUrl}/register?ref=${code}`;

  function toggle(a: AmbassadorRow, active: boolean) {
    setActiveOverride((o) => ({ ...o, [a.id]: active }));
    startTransition(async () => {
      const res = await setAmbassadorActive(a.id, active);
      if (!res.ok) {
        setActiveOverride((o) => ({ ...o, [a.id]: !active }));
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {isWriter && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing({ name: "", email: "", phone: "", college: null, referralCode: "" })}>
            <PlusIcon /> Add ambassador
          </Button>
        </div>
      )}
      {ambassadors.length === 0 ? (
        <EmptyState
          icon={MegaphoneIcon}
          title="No ambassadors yet"
          description="Add campus ambassadors to give each one a referral link and QR code, and see who brings in colleges."
        />
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border bg-card">
          {ambassadors.map((a) => {
            const active = activeOverride[a.id] ?? a.active;
            return (
              <li key={a.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3", !active && "opacity-60")}>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.college?.name ?? "No college"}</p>
                </div>
                <div className="flex basis-40 items-center gap-1">
                  <span className="font-mono text-sm">{a.code}</span>
                  <CopyButton value={link(a.code)} label="referral link" />
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setQr(a)} aria-label={`QR code for ${a.name}`}>
                    <QrCodeIcon />
                  </Button>
                </div>
                <div className="basis-36 text-sm">
                  <span className="font-mono text-lg">{a.signupsSeason}</span>
                  <span className="text-xs text-muted-foreground"> in {seasonName}</span>
                  <p className="text-xs text-muted-foreground">{a.signupsTotal} all time</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={active} disabled={!isWriter} onCheckedChange={(v) => toggle(a, v)} aria-label={`${a.name} active`} />
                  {isWriter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Edit ${a.name}`}
                      onClick={() =>
                        setEditing({ id: a.id, name: a.name, email: a.email ?? "", phone: a.phone ?? "", college: a.college, referralCode: a.code })
                      }
                    >
                      <PencilIcon />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {editing && <AmbassadorDialog key={editing.id ?? "new"} initial={editing} onClose={() => setEditing(null)} />}
      {qr && <QrDialog name={qr.name} code={qr.code} link={link(qr.code)} onClose={() => setQr(null)} />}
    </div>
  );
}
