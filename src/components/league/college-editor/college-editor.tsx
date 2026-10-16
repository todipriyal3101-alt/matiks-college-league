"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, UsersIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import { restoreRegistrations, setReviewStatus, setStage } from "@/app/admin/(panel)/overview-actions";
import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import type { RegistrationDetail } from "@/lib/data/league-ops";
import { REVIEW_LABELS, STAGE_LABELS, type ReviewStatus, type Stage } from "@/lib/league";
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
import { EditorHeader } from "./editor-header";
import { toFormValues, type EditorFormValues } from "./form-values";
import { SectionHeader } from "./section-header";
import { WinnersSection, type WinnerStatus } from "./winners-section";

type Overrides = {
  reviewStatus?: ReviewStatus;
  stage?: Stage;
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
}: {
  detail: RegistrationDetail;
  mode: EditorMode;
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
      // Errors can be in a collapsed winner row or off-screen: say so and jump to the first one.
      toast.error("Some details need fixing before you can save.");
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[data-invalid=true] input, [data-invalid=true] textarea")?.focus(),
      );
    },
  );

  // ---------- Immediate toggles (admin) ----------
  const reviewStatus = overrides.reviewStatus ?? detail.registration.status;
  const stage = overrides.stage ?? detail.registration.stage;

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

  function changeRegistration(patch: { reviewStatus?: ReviewStatus; stage?: Stage }) {
    setOverrides((o) => ({ ...o, ...patch }));
    startToggle(async () => {
      const res = patch.reviewStatus
        ? await setReviewStatus([registrationId], patch.reviewStatus)
        : await setStage([registrationId], patch.stage!);
      if (!res.ok) {
        setOverrides((o) => ({ ...o, reviewStatus: undefined, stage: undefined }));
        toast.error(res.error);
        return;
      }
      const label = patch.reviewStatus ? REVIEW_LABELS[patch.reviewStatus] : STAGE_LABELS[patch.stage!];
      undoToast(`${patch.reviewStatus ? "Review" : "Stage"} → ${label}`, () => restoreRegistrations(res.previous));
    });
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
    undoToast(`${w?.position ?? "Winner"} marked paid`, () => restoreWinnerPayment(winnerId, res.previous));
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
      undoToast("Marked unpaid", () => restoreWinnerPayment(winnerId, res.previous));
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
      undoToast(sent ? "Merch marked sent" : "Merch marked not sent", () => setMerchSent(target, id, !sent));
    });
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className={isDirty ? "space-y-10 pb-24" : "space-y-10"}
      >
        <EditorHeader
          detail={detail}
          mode={mode}
          readOnly={readOnly}
          reviewStatus={reviewStatus}
          stage={stage}
          onReviewStatus={(s) => changeRegistration({ reviewStatus: s })}
          onStage={(s) => changeRegistration({ stage: s })}
        />

        <ContactsSection
          saved={detail.contacts}
          isAdmin={isAdmin}
          readOnly={readOnly}
          merchSent={(id) => overrides.contacts[id] ?? detail.contacts.find((c) => c.id === id)?.merch_sent ?? false}
          onMerchSent={(id, sent) => onMerch("contact", id, sent)}
        />

        <WinnersSection
          saved={detail.winners}
          isAdmin={isAdmin}
          readOnly={readOnly}
          status={winnerStatus}
          onMarkPaid={onMarkPaid}
          onMarkUnpaid={onMarkUnpaid}
          onMerchSent={(id, sent) => onMerch("winner", id, sent)}
        />

        <div className="grid gap-10 lg:grid-cols-2">
          <section>
            <SectionHeader title="Participants" subtitle={`${detail.participants.length} registered players`} />
            {detail.participants.length === 0 ? (
              <EmptyState
                icon={UsersIcon}
                title="No players listed"
                description={isAdmin ? "Players added on the registration form appear here." : "Teammates you added when registering appear here."}
              />
            ) : (
              <ul className="divide-y divide-border/60 rounded-xl border bg-card">
                {detail.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {p.year && <span>{p.year}</span>}
                      <span className="font-mono">@{p.matiks_username}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <SectionHeader title="Activity" />
            <ActivityTimeline entries={detail.activity} me={me} mode={mode} adminNames={adminNames} />
          </section>
        </div>

        {isDirty && !readOnly && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-primary/40 bg-card/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
              <span className="mr-auto text-sm font-medium">Unsaved changes</span>
              <Button type="button" variant="ghost" onClick={() => form.reset()} disabled={saving}>
                Discard
              </Button>
              <Button type="submit" disabled={saving}>
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
