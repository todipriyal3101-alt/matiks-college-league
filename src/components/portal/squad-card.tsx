"use client";

import { CopyIcon, Loader2Icon, Share2Icon, UserPlusIcon, UsersIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { decideJoinRequest } from "@/app/college/register-actions";
import { Glass } from "@/components/glass";
import { Button } from "@/components/ui/button";

type Member = { id: string; name: string; email: string; is_primary: boolean };
type Request = { id: string; name: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

/**
 * "Build your squad": up to 3 people per college. Filled spots, one personal co-lead link per open spot (whoever
 * opens it and signs up joins automatically; links expire when the team is full), and "Ask to join" requests.
 */
export function SquadCard({
  members,
  invites,
  requests,
  siteUrl,
  myEmail,
  college,
  highlight = false,
}: {
  members: Member[];
  invites: string[];
  requests: Request[];
  siteUrl: string;
  myEmail: string;
  college: string;
  highlight?: boolean;
}) {
  const [pending, start] = useTransition();
  const filled = Math.min(3, members.length);
  const link = (code: string) => `${siteUrl}/j/${code}`;

  async function share(code: string) {
    const text = `Join me as a co-lead for ${college} in the Matiks College League:`;
    try {
      if (navigator.share) await navigator.share({ title: "Matiks College League", text, url: link(code) });
      else {
        await navigator.clipboard.writeText(`${text} ${link(code)}`);
        toast.success("Link copied");
      }
    } catch {}
  }

  const decide = (id: string, accept: boolean) =>
    start(async () => {
      const res = await decideJoinRequest(id, accept);
      if (!res.ok) toast.error(res.error);
      else toast.success(accept ? "Added to your team" : "Request declined");
    });

  return (
    <Glass id="team" className={`scroll-mt-28 space-y-4 p-5 sm:p-6 ${highlight ? "shadow-[inset_0_0_0_1px_rgb(177_250_99/0.35),var(--glass-edge),var(--glass-drop)]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-sans text-base font-bold normal-case">
            <UsersIcon className="size-4 text-primary" aria-hidden /> Build your squad
          </h2>
          <p className="text-sm text-muted-foreground">Send a personal link to up to 2 co-leads. They sign up and join your team automatically.</p>
        </div>
        <span className="rounded-full bg-olive px-3 py-1 font-mono text-sm font-bold text-primary">{filled} of 3 spots filled</span>
      </div>

      {requests.length > 0 && (
        <ul className="space-y-2" aria-label="Requests to join">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-lilac/10 p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lilac text-sm font-extrabold text-background">{initials(r.name)}</span>
              <p className="min-w-40 flex-1 text-sm">
                <span className="font-semibold">{r.name}</span> asked to join your team
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="h-10 rounded-full" disabled={pending} onClick={() => decide(r.id, false)}>
                  Decline
                </Button>
                <Button className="h-10 rounded-full" disabled={pending || filled >= 3} onClick={() => decide(r.id, true)}>
                  {pending && <Loader2Icon className="animate-spin" />} Accept
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-2">
        {members.slice(0, 3).map((m) => (
          <li key={m.id} className="glass-surface flex items-center gap-3 rounded-2xl p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-lilac text-sm font-extrabold text-background">{initials(m.name)}</span>
            <span className="min-w-0 flex-1 truncate">
              <span className="font-semibold">{m.name}</span>
              {m.email.toLowerCase() === myEmail.toLowerCase() && <span className="text-sm text-muted-foreground"> · you</span>}
            </span>
            {m.is_primary && <span className="rounded-full bg-primary/14 px-2.5 py-0.5 text-xs font-bold text-primary">Primary</span>}
          </li>
        ))}
        {invites.map((code, i) => (
          <li key={code} className="glass-surface flex items-center gap-3 rounded-2xl p-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/8 text-sm font-bold">
              <UserPlusIcon className="size-4" aria-hidden />
              <span className="sr-only">Open spot {filled + i + 1}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Co-lead spot</span>
              <span className="block truncate font-mono text-xs text-muted-foreground">{link(code).replace(/^https?:\/\//, "")}</span>
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 rounded-full"
              aria-label="Copy co-lead link"
              onClick={() => void navigator.clipboard.writeText(link(code)).then(() => toast.success("Link copied"))}
            >
              <CopyIcon />
            </Button>
            <Button variant="outline" className="h-10 rounded-full px-3.5" onClick={() => void share(code)}>
              <Share2Icon /> <span className="hidden sm:inline">Share</span>
            </Button>
          </li>
        ))}
      </ul>
      {filled >= 3 && <p className="text-sm text-muted-foreground">Your team is full. Co-lead links stop working once all 3 spots are filled.</p>}
    </Glass>
  );
}
