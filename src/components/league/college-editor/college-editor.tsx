"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, UsersIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { denyRegistration, restoreRegistrations, setReviewStatus, setStage } from "@/app/admin/(panel)/overview-actions";
import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RegistrationDetail } from "@/lib/data/league-ops";
import { deriveStage, REVIEW_LABELS, STAGE_LABELS, type ReviewStatus, type Stage } from "@/lib/league";
import {
  markWinnerPaid,
  restoreWinnerPayment,
  saveEditor,
  setMerchSent,
  type EditorMode,
} from "@/lib/league-ops/editor-actions";
import { adminEditorSchema, editorSchema } from "@/lib/validation/league-ops";

import { ActivityTimeline } from "./activity-timeline";
import { ContactsSection } from "./contacts-section";
import { EditorTopBar, OverviewPanel } from "./editor-header";
import { PocChecklist } from "./poc-checklist";
import { toFormValues, type EditorFormValues } from "./form-values";
import { MarkPaidDialog, WinnersSection, type WinnerStatus } from "./winners-section";

export const EDITOR_TABS = ["overview", "contacts", "winners", "participants", "activity"] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

type Overrides = {
  reviewStatus?: ReviewStatus;
  /** Wrapped so "back to Auto" (null) differs from "no local change" (undefined). */
  stageOverride?: { value: Stage | null };
  winners: Record<string, Partial<WinnerStatus>>;
  contacts: Record<string, boolean>;
};
const NO_OVERRIDES: Overrides = { winners: {}, contacts: {} };

/**
 * One editor for a registration (= one college in one season), in admin or POC mode (SPEC "League operations").
 * Text fields go through one form with a sticky "Unsaved changes · Discard · Save" bar; admin toggles
 * (review, stage, paid, merch) save immediately with an Undo toast. The database enforces every rule.
 */
export function CollegeEditor({
  detail: serverDetail,
  mode,
  readOnly = false,
  me,
  adminNames,
  sections,
}: {
  detail: RegistrationDetail;
  mode: EditorMode;
  /** Show only these tabs (POC panel: Winners tab, Profile & contacts). One section hides the tab bar. */
  sections?: readonly EditorTab[];
  /** Viewers: everything visible, nothing editable. */
  readOnly?: boolean;
  me: string | null;
  adminNames: Record<string, string>;
}) {
  const isAdmin = mode === "admin";
  // Latest known data: from the server (props), or from a save's response (saves don't re-render the page).
  const [detail, setDetail] = useState(serverDetail);
  const registrationId = detail.registration.id;
  const form = useForm<EditorFormValues>({
    resolver: zodResolver(isAdmin ? adminEditorSchema : editorSchema) as unknown as Resolver<EditorFormValues>,
    defaultValues: toFormValues(detail),
    mode: "onTouched",
  });
  const [saving, startSaving] = useTransition();
  const [, startToggle] = useTransition();

  // Optimistic toggle state; cleared whenever fresh data arrives from the server.
  const [overrides, setOverrides] = useState<Overrides>(NO_OVERRIDES);
  const [payFor, setPayFor] = useState<string | null>(null);

  // The tab lives in the URL (?tab=winners) so links and the POC checklist can open it directly. Switching uses
  // history.replaceState: instant, no server round trip (Next keeps useSearchParams in sync).
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const tabs = sections ?? EDITOR_TABS;
  const tab: EditorTab = (tabs as readonly string[]).includes(urlTab ?? "") ? (urlTab as EditorTab) : tabs[0];
  function openTab(next: EditorTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === tabs[0]) params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }
  const [seen, setSeen] = useState(serverDetail);
  if (seen !== serverDetail) {
    setSeen(serverDetail);
    setDetail(serverDetail);
    setOverrides(NO_OVERRIDES);
  }

  // Someone else's change (or a toggle) refreshed the data: take it, unless the user has unsaved edits.
  const { isDirty } = form.formState;
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toFormValues(detail));
  }, [detail, form]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  const save = form.handleSubmit(
    (data) =>
      startSaving(async () => {
        const res = await saveEditor(registrationId, mode, data);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setDetail(res.detail);
        form.reset(toFormValues(res.detail));
        toast.success("Saved");
      }),
    () => {
      // The first error may be in another tab or a collapsed winner row: open that tab, then focus it.
      const first = document.querySelector<HTMLElement>("[data-invalid=true] input, [data-invalid=true] textarea");
      const panel = first?.closest<HTMLElement>("[data-editor-tab]")?.dataset.editorTab as EditorTab | undefined;
      if (panel) openTab(panel);
      // A section this page doesn't show (POC Winners page) can't be fixed here: say where.
      const hidden = (Object.keys(form.formState.errors) as string[]).find((k) => k === "contacts" || k === "winners" || k === "teamName");
      if (!first && hidden && !tabs.includes(hidden === "teamName" ? "overview" : (hidden as EditorTab))) {
        toast.error(hidden === "contacts" ? "A contact's details need fixing first: open Profile & contacts." : `Fix the ${hidden} first.`);
        return;
      }
      toast.error("Fix the highlighted fields");
      // Focus once the tab switch has rendered (a hidden panel can't take focus).
      setTimeout(() => first?.focus(), 80);
    },
  );

  // ---------- Immediate toggles (admin) ----------
  const reviewStatus = overrides.reviewStatus ?? detail.registration.status;
  const stageOverride = overrides.stageOverride ? overrides.stageOverride.value : detail.registration.stage_override;

  function undoToast(message: string, undo: () => Promise<{ ok: boolean; error?: string }>) {
    toast.success(message, {
      action: {
        label: "Undo",
        onClick: () =>
          startToggle(async () => {
            const res = await undo();
            if (!res.ok) toast.error(res.error ?? "Couldn't undo.");
          }),
      },
    });
  }

  function changeRegistration(patch: { reviewStatus: ReviewStatus } | { stage: Stage | null }) {
    setOverrides((o) => ({ ...o, ...("reviewStatus" in patch ? { reviewStatus: patch.reviewStatus } : { stageOverride: { value: patch.stage } }) }));
    startToggle(async () => {
      const res = "reviewStatus" in patch ? await setReviewStatus([registrationId], patch.reviewStatus) : await setStage([registrationId], patch.stage);
      if (!res.ok) {
        setOverrides((o) => ({ ...o, reviewStatus: undefined, stageOverride: undefined }));
        toast.error(res.error);
        return;
      }
      const label =
        "reviewStatus" in patch ? REVIEW_LABELS[patch.reviewStatus] : patch.stage ? `Stage: ${STAGE_LABELS[patch.stage]}` : "Stage: automatic";
      undoToast(label, () => restoreRegistrations(res.previous));
    });
  }

  async function deny(reason: string): Promise<string | null> {
    const res = await denyRegistration(registrationId, reason || null);
    if (!res.ok) return res.error;
    setOverrides((o) => ({ ...o, reviewStatus: "rejected" }));
    undoToast("Denied", () => restoreRegistrations(res.previous));
    return null;
  }

  const winnerStatus = (id: string): WinnerStatus => {
    const w = detail.winners.find((x) => x.id === id)!;
    const o = overrides.winners[id] ?? {};
    return {
      paid: o.paid ?? w.payment_status === "paid",
      reference: o.reference ?? w.payment_reference,
      merchSent: o.merchSent ?? w.merch_sent,
    };
  };
  const setWinnerOverride = (id: string, patch: Partial<WinnerStatus> | null) =>
    setOverrides((o) => {
      const winners = { ...o.winners };
      if (patch) winners[id] = { ...winners[id], ...patch };
      else delete winners[id];
      return { ...o, winners };
    });

  async function onMarkPaid(winnerId: string, utr: string): Promise<string | null> {
    const res = await markWinnerPaid({ winnerId, utr });
    if (!res.ok) return res.error;
    setWinnerOverride(winnerId, { paid: true, reference: utr.toUpperCase() });
    const w = detail.winners.find((x) => x.id === winnerId);
    undoToast(`${w?.position ?? "Winner"} paid`, () => restoreWinnerPayment(winnerId, res.previous));
    return null;
  }

  function onMarkUnpaid(winnerId: string) {
    const before = winnerStatus(winnerId);
    setWinnerOverride(winnerId, { paid: false });
    startToggle(async () => {
      const res = await restoreWinnerPayment(winnerId, { status: "pending", reference: before.reference });
      if (!res.ok) {
        setWinnerOverride(winnerId, null);
        toast.error(res.error);
        return;
      }
      undoToast("Unpaid", () => restoreWinnerPayment(winnerId, res.previous));
    });
  }

  function onMerch(target: "winner" | "contact", id: string, sent: boolean) {
    if (target === "winner") setWinnerOverride(id, { merchSent: sent });
    else setOverrides((o) => ({ ...o, contacts: { ...o.contacts, [id]: sent } }));
    startToggle(async () => {
      const res = await setMerchSent(target, id, sent);
      if (!res.ok) {
        if (target === "winner") setWinnerOverride(id, null);
        else setOverrides((o) => ({ ...o, contacts: { ...o.contacts, [id]: !sent } }));
        toast.error(res.error);
        return;
      }
      undoToast(sent ? "Merch sent" : "Merch not sent", () => setMerchSent(target, id, !sent));
    });
  }

  // What "Auto" means right now: the dates (as saved) and the payouts (including unsaved paid toggles).
  const autoStage = deriveStage({
    stored: detail.registration.stage,
    country: detail.registration.colleges.country,
    leagueStart: detail.registration.league_start,
    leagueEnd: detail.registration.league_end,
    winnersTotal: detail.winners.length,
    winnersPaid: detail.winners.filter((w) => winnerStatus(w.id).paid).length,
  });
  const stage = stageOverride ?? autoStage;

  const unpaid = detail.winners
    .filter((w) => !winnerStatus(w.id).paid)
    .map((w) => ({ id: w.id, label: [w.position, w.name].filter(Boolean).join(" · ") }));
  const counts: Partial<Record<EditorTab, number>> = {
    contacts: detail.contacts.length,
    winners: detail.winners.length,
    participants: detail.participants.length,
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className={isDirty ? "space-y-5 pb-24" : "space-y-5"}
      >
        <EditorTopBar
          detail={detail}
          mode={mode}
          readOnly={readOnly}
          reviewStatus={reviewStatus}
          stage={stage}
          stageOverride={stageOverride}
          autoStage={autoStage}
          unpaid={unpaid}
          onReviewStatus={(s) => changeRegistration({ reviewStatus: s })}
          onDeny={deny}
          onStage={(s) => changeRegistration({ stage: s })}
          onMarkPaid={setPayFor}
        />

        {!isAdmin && !readOnly && !sections && <PocChecklist detail={detail} stage={stage} status={winnerStatus} onOpen={openTab} />}

        <Tabs id="editor-tabs" value={tab} onValueChange={(v) => openTab(v as EditorTab)} className="scroll-mt-40">
          <div className={tabs.length > 1 ? "-mx-4 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:px-0" : "hidden"}>
            <TabsList variant="line" className="h-11 w-max min-w-full justify-start border-b border-border/60 sm:min-w-0 sm:border-0">
              {tabs.map((t) => (
                <TabsTrigger key={t} value={t} className="h-10 flex-none px-3 capitalize">
                  {t}
                  {counts[t] !== undefined && <span className="font-mono text-xs text-muted-foreground">{counts[t]}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Panels stay mounted (hidden when inactive) so unsaved edits and their errors survive tab switches. */}
          {tabs.includes("overview") && (
          <TabsContent forceMount value="overview" data-editor-tab="overview" className="fade-in pt-4 data-[state=inactive]:hidden">
            <OverviewPanel
              mode={mode}
              readOnly={readOnly}
              participantCount={detail.registration.participant_count}
              registrationId={registrationId}
              source={detail.registration}
            />
          </TabsContent>
          )}
          {tabs.includes("contacts") && (
          <TabsContent forceMount value="contacts" data-editor-tab="contacts" className="fade-in pt-4 data-[state=inactive]:hidden">
            <ContactsSection
              saved={detail.contacts}
              isAdmin={isAdmin}
              readOnly={readOnly}
              merchSent={(id) => overrides.contacts[id] ?? detail.contacts.find((c) => c.id === id)?.merch_sent ?? false}
              onMerchSent={(id, sent) => onMerch("contact", id, sent)}
            />
          </TabsContent>
          )}
          {tabs.includes("winners") && (
          <TabsContent forceMount value="winners" data-editor-tab="winners" className="fade-in pt-4 data-[state=inactive]:hidden">
            <WinnersSection
              saved={detail.winners}
              isAdmin={isAdmin}
              readOnly={readOnly}
              status={winnerStatus}
              onRequestPay={setPayFor}
              onMarkUnpaid={onMarkUnpaid}
              onMerchSent={(id, sent) => onMerch("winner", id, sent)}
            />
          </TabsContent>
          )}
          {tabs.includes("participants") && (
          <TabsContent forceMount value="participants" data-editor-tab="participants" className="fade-in pt-4 data-[state=inactive]:hidden">
            {detail.participants.length === 0 ? (
              <EmptyState icon={UsersIcon} title="No players yet" description="Teammates added when registering show up here." />
            ) : (
              <ul className="divide-y divide-border/60 rounded-2xl border bg-card">
                {detail.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {p.year && <span>{p.year}</span>}
                      <span className="font-mono">@{p.matiks_username}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
          )}
          {tabs.includes("activity") && (
          <TabsContent forceMount value="activity" data-editor-tab="activity" className="fade-in pt-4 data-[state=inactive]:hidden">
            <ActivityTimeline entries={detail.activity} me={me} mode={mode} adminNames={adminNames} />
          </TabsContent>
          )}
        </Tabs>

        {isAdmin && (
          <MarkPaidDialog
            winner={detail.winners.find((w) => w.id === payFor) ?? null}
            onClose={() => setPayFor(null)}
            onConfirm={async (utr) => {
              const error = await onMarkPaid(payFor!, utr);
              if (!error) setPayFor(null);
              return error;
            }}
          />
        )}

        {isDirty && !readOnly && (
          <div className="glass-strong fixed inset-x-0 bottom-0 z-40 shadow-[inset_0_1px_0_rgb(177_250_99/0.4)]">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <span className="mr-auto text-sm font-semibold">Unsaved changes</span>
              <Button type="button" variant="ghost" onClick={() => form.reset()} disabled={saving}>
                Discard
              </Button>
              <Button type="submit" className="h-10 px-5" disabled={saving}>
                {saving && <Loader2Icon className="animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        )}
      </form>
    </FormProvider>
  );
}
