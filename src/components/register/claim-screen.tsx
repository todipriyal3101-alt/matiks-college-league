"use client";

import { ArrowRightIcon, Loader2Icon, MapPinIcon, PlusIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelJoinRequest, forgetSquadLink, getClaimStatuses, getRivalry, requestToJoin, type ClaimStatus } from "@/app/college/register-actions";
import { CollegeSearch } from "@/components/college-search";
import { Glass } from "@/components/glass";
import { ActivityTicker, type ActivityItem } from "@/components/launch/activity-ticker";
import { CollegeLogo } from "@/components/league/college-logo";
import { Sticker } from "@/components/stickers";
import { Button } from "@/components/ui/button";
import type { CollegeSearchResult } from "@/lib/data/colleges";

export type PendingJoin = { id: string; collegeName: string };

/**
 * "Claim your campus": one big search. Unclaimed → start registering with it; claimed this season → "Already
 * claimed by Ravi K." + Ask to join (never a duplicate registration); not listed → add it. Below: the state
 * rivalry line, early-bird spots and the live ticker.
 */
export function ClaimScreen({
  season,
  activity,
  earlyBirdLeft,
  pendingJoin,
  squadError,
  onClaim,
}: {
  season: string;
  activity: ActivityItem[];
  earlyBirdLeft: number;
  pendingJoin: PendingJoin | null;
  /** A remembered co-lead link that couldn't be used (shown once, then forgotten). */
  squadError: string | null;
  onClaim: (college: CollegeSearchResult | null, newName: string | null) => void;
}) {
  const router = useRouter();
  const [claims, setClaims] = useState<Record<string, ClaimStatus | null>>({});
  const [picked, setPicked] = useState<CollegeSearchResult | null>(null);
  const [rivalry, setRivalry] = useState<{ state: string; count: number } | null>(null);
  const [pending, start] = useTransition();

  const onResults = useCallback(async (results: CollegeSearchResult[]) => {
    const unknown = results.map((r) => r.id).filter((id) => !(id in claims));
    if (!unknown.length) return;
    const found = await getClaimStatuses(unknown);
    setClaims((prev) => ({ ...prev, ...Object.fromEntries(unknown.map((id) => [id, found[id] ?? null])) }));
  }, [claims]);

  async function pick(c: CollegeSearchResult) {
    setPicked(c);
    if (!(c.id in claims)) {
      const found = await getClaimStatuses([c.id]);
      setClaims((prev) => ({ ...prev, [c.id]: found[c.id] ?? null }));
    }
    if (c.state) {
      const state = c.state;
      setRivalry({ state, count: await getRivalry(state) });
    } else setRivalry(null);
  }

  useEffect(() => {
    if (squadError) void forgetSquadLink();
  }, [squadError]);

  const claim = picked ? claims[picked.id] : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{season}</p>
          <h1 className="text-6xl sm:text-7xl">
            Claim your <span className="text-primary">campus</span>
          </h1>
          <p className="mt-2 max-w-xl text-foreground/85">Every college gets one Campus Lead team. Find yours before someone else does.</p>
        </div>
        <Sticker name="vault" className="hidden h-auto w-28 shrink-0 sm:block" style={{ "--tilt": "8deg" } as React.CSSProperties} />
      </div>

      {squadError && (
        <p role="alert" className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm">
          <span className="font-semibold">That co-lead link didn&apos;t work:</span> {squadError}
        </p>
      )}

      {pendingJoin && (
        <Glass className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
          <UsersIcon className="size-5 shrink-0 text-lilac" aria-hidden />
          <p className="flex-1 text-sm">
            You asked to join <span className="font-semibold">{pendingJoin.collegeName}</span>&apos;s team. We&apos;ll tell you when they answer.
          </p>
          <Button
            variant="outline"
            className="h-10 rounded-full"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await cancelJoinRequest(pendingJoin.id);
                if (!res.ok) toast.error(res.error);
              })
            }
          >
            Cancel request
          </Button>
        </Glass>
      )}

      <Glass className="space-y-2 p-4 sm:p-5">
        <label htmlFor="claim-search" className="text-sm font-semibold">
          Find your college
        </label>
        <CollegeSearch
          id="claim-search"
          size="lg"
          autoFocus
          selectedId={picked?.id ?? null}
          selectedLabel={picked?.name ?? ""}
          placeholder="Start typing, e.g. IIT Guwahati"
          onSelect={(c) => void pick(c)}
          onQueryChange={() => picked && setPicked(null)}
          onResults={onResults}
          onAddNew={(name) => onClaim(null, name)}
          renderBadge={(c) =>
            c.id in claims ? (
              claims[c.id] ? (
                <span className="rounded-full bg-status-pending px-2 py-0.5 text-[11px] font-bold text-status-pending-fg">Claimed</span>
              ) : (
                <span className="rounded-full bg-primary/14 px-2 py-0.5 text-[11px] font-bold text-primary">Unclaimed</span>
              )
            ) : null
          }
        />
      </Glass>

      {picked && claim === null && (
        <Glass className="flex flex-col gap-4 p-5 shadow-[inset_0_0_0_1px_rgb(177_250_99/0.4),var(--glass-edge),var(--glass-drop)] sm:flex-row sm:items-center">
          <CollegeLogo url={null} name={picked.name} className="size-13" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">{picked.name} is unclaimed.</p>
            <p className="text-foreground/85">Claim it before someone else does!</p>
          </div>
          <Button className="h-12 rounded-full px-6" onClick={() => onClaim(picked, null)}>
            Claim {picked.short_name || picked.name} <ArrowRightIcon />
          </Button>
        </Glass>
      )}

      {picked && claim && (
        <Glass className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <CollegeLogo url={null} name={picked.name} className="size-13" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {picked.name} is already claimed by <span className="text-primary">{claim.claimedBy}</span>
              {claim.claimedBy.endsWith(".") ? "" : "."}
            </p>
            <p className="text-sm text-muted-foreground">Join their team instead: they accept or decline in their panel (max 3 per college).</p>
          </div>
          <Button
            variant="outline"
            className="h-12 rounded-full px-6"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await requestToJoin(claim.registrationId);
                if (!res.ok) return void toast.error(res.error);
                toast.success(`Request sent to ${picked.name}'s team`);
                setPicked(null);
                router.refresh();
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <UsersIcon />} Ask to join
          </Button>
        </Glass>
      )}

      {!picked && (
        <button
          type="button"
          onClick={() => onClaim(null, "")}
          className="flex items-center gap-2 px-1 text-sm font-semibold text-lilac underline-offset-4 hover:underline"
        >
          <PlusIcon className="size-4" aria-hidden /> My college isn&apos;t in the list
        </button>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {rivalry && (
          <div className="glass-surface flex items-start gap-3 rounded-2xl p-4">
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p className="text-sm">
              {rivalry.count === 0 ? (
                <>No college from {rivalry.state} is in yet. Be the first!</>
              ) : (
                <>
                  <span className="font-bold">
                    {rivalry.count} {rivalry.count === 1 ? "college" : "colleges"} from {rivalry.state}
                  </span>{" "}
                  {rivalry.count === 1 ? "is" : "are"} in
                </>
              )}
            </p>
          </div>
        )}
        {earlyBirdLeft > 0 && (
          <div className="glass-surface space-y-2 rounded-2xl p-4">
            <p className="text-sm">
              🐣 <span className="font-bold">Early bird badge:</span> {earlyBirdLeft} of 10 spots left
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#e8ff9c]" style={{ width: `${(10 - earlyBirdLeft) * 10}%` }} />
            </div>
          </div>
        )}
      </div>

      <ActivityTicker initial={activity} />
    </div>
  );
}
