"use client";

import { ChevronDownIcon, LockIcon, PlusIcon, Trash2Icon, TrophyIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { PillBadge } from "@/components/league/badges";
import { CopyButton } from "@/components/league/copy-button";
import { EmptyState } from "@/components/league/empty-state";
import { Money } from "@/components/league/money";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Tables } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { PRIZE_TYPES, PRIZE_TYPE_LABELS } from "@/lib/validation/league-ops";

import { TshirtSelect } from "./contacts-section";
import { emptyWinner, ordinal, type EditorFormValues } from "./form-values";
import { SectionHeader } from "./section-header";

const GRID = "md:grid md:grid-cols-[5.5rem_minmax(8rem,1.2fr)_minmax(9rem,1fr)_minmax(10rem,1.2fr)_8.5rem_7.5rem_7rem_4.5rem] md:items-center md:gap-3";

export type WinnerStatus = { paid: boolean; reference: string | null; merchSent: boolean };

export function WinnersSection({
  saved,
  isAdmin,
  readOnly,
  status,
  onRequestPay,
  onMarkUnpaid,
  onMerchSent,
}: {
  saved: Tables<"winners">[];
  isAdmin: boolean;
  readOnly: boolean;
  status: (winnerId: string) => WinnerStatus;
  /** Opens the "Mark paid" (UTR) dialog, owned by the editor so the top bar can open it too. */
  onRequestPay: (winnerId: string) => void;
  onMarkUnpaid: (winnerId: string) => void;
  onMerchSent: (winnerId: string, sent: boolean) => void;
}) {
  const { control } = useFormContext<EditorFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "winners", keyName: "key" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);

  return (
    <section>
      <SectionHeader
        title="Winners"
        action={
          !readOnly ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                append(emptyWinner(ordinal(fields.length + 1)));
                setExpanded(`new-${fields.length}`);
              }}
            >
              <PlusIcon /> Add winner
            </Button>
          ) : null
        }
      />

      {fields.length === 0 ? (
        <EmptyState
          icon={TrophyIcon}
          title="No winners yet"
          description={readOnly ? "Added winners show up here." : "Add winners once results are in."}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className={cn(GRID, "hidden bg-muted/40 px-4 py-2.5 text-xs tracking-wider text-muted-foreground uppercase md:grid")}>
            <span>Position</span>
            <span>Name</span>
            <span>Phone</span>
            <span>UPI</span>
            <span>Prize</span>
            <span>Payment</span>
            <span>Merch</span>
            <span className="sr-only">Actions</span>
          </div>
          <ul className="divide-y divide-border/60">
            {fields.map((field, i) => {
              const stored = saved.find((w) => w.id === field.id);
              const st = stored ? status(stored.id) : { paid: false, reference: null, merchSent: false };
              const rowKey = stored?.id ?? `new-${i}`;
              // POCs can't edit a paid winner (database rule); admins can.
              const locked = readOnly || (!isAdmin && st.paid);
              return (
                <WinnerRow
                  key={field.key}
                  index={i}
                  stored={stored}
                  status={st}
                  isAdmin={isAdmin}
                  readOnly={readOnly}
                  locked={locked}
                  expanded={expanded === rowKey}
                  onToggleExpand={() => setExpanded(expanded === rowKey ? null : rowKey)}
                  onDelete={() => setToDelete(i)}
                  onPaidChange={(paid) => (paid ? onRequestPay(stored!.id) : onMarkUnpaid(stored!.id))}
                  onMerchSent={(sent) => onMerchSent(stored!.id, sent)}
                />
              );
            })}
          </ul>
        </div>
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this winner?</AlertDialogTitle>
            <AlertDialogDescription>
              It&apos;s removed when you save. Discard your changes to bring it back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (toDelete !== null) remove(toDelete);
                setToDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </section>
  );
}

function WinnerRow({
  index: i,
  stored,
  status: st,
  isAdmin,
  readOnly,
  locked,
  expanded,
  onToggleExpand,
  onDelete,
  onPaidChange,
  onMerchSent,
}: {
  index: number;
  stored: Tables<"winners"> | undefined;
  status: WinnerStatus;
  isAdmin: boolean;
  readOnly: boolean;
  locked: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onPaidChange: (paid: boolean) => void;
  onMerchSent: (sent: boolean) => void;
}) {
  const { register, control, formState } = useFormContext<EditorFormValues>();
  const e = formState.errors.winners?.[i];
  const prizeType = useWatch({ control, name: `winners.${i}.prizeType` });
  const canToggle = isAdmin && !readOnly && !!stored;
  // Show the details panel when one of its fields is invalid, so the error is visible.
  const open = expanded || !!(e?.email || e?.matiksUsername || e?.pincode || e?.address || e?.merchDescription);

  return (
    <li className={cn("px-4 py-3", st.paid && !isAdmin && "bg-status-live/10")}>
      <div className={cn(GRID, "grid grid-cols-2 gap-x-3 gap-y-2")}>
        <Field data-invalid={!!e?.position} className="col-span-1">
          <FieldLabel htmlFor={`w${i}-pos`} className="md:sr-only">Position</FieldLabel>
          <div className="flex items-center gap-1.5">
            {locked && !readOnly && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <LockIcon className="size-3.5 shrink-0 text-status-live-fg" aria-label="Paid: locked" />
                </TooltipTrigger>
                <TooltipContent>Paid — contact a Matiks admin to change it</TooltipContent>
              </Tooltip>
            )}
            <Input id={`w${i}-pos`} className="h-8" disabled={locked} {...register(`winners.${i}.position`)} />
          </div>
          <FieldError errors={[e?.position]} />
        </Field>
        <Field className="col-span-1">
          <FieldLabel htmlFor={`w${i}-name`} className="md:sr-only">Name</FieldLabel>
          <Input id={`w${i}-name`} className="h-8" disabled={locked} {...register(`winners.${i}.name`)} />
        </Field>
        {/* Phone and UPI take the full width on phones so a 10-digit number isn't clipped. */}
        <Field data-invalid={!!e?.phone} className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor={`w${i}-phone`} className="md:sr-only">Phone</FieldLabel>
          <div className="flex items-center gap-0.5">
            <Input id={`w${i}-phone`} className="h-8" type="tel" inputMode="numeric" disabled={locked} {...register(`winners.${i}.phone`)} />
            {stored?.phone && <CopyButton value={stored.phone} label="phone" />}
          </div>
          <FieldError errors={[e?.phone]} />
        </Field>
        <Field data-invalid={!!e?.upiId} className="col-span-2 sm:col-span-1">
          <FieldLabel htmlFor={`w${i}-upi`} className="md:sr-only">UPI ID</FieldLabel>
          <div className="flex items-center gap-0.5">
            <Input id={`w${i}-upi`} className="h-8 font-mono text-xs" autoCapitalize="none" placeholder="name@bank" disabled={locked} {...register(`winners.${i}.upiId`)} />
            {stored?.upi_id && <CopyButton value={stored.upi_id} label="UPI ID" />}
          </div>
          <FieldError errors={[e?.upiId]} />
        </Field>
        <div className="col-span-2 md:col-span-1">
          <span className="text-xs text-muted-foreground md:sr-only">Prize</span>
          {isAdmin ? (
            <Field data-invalid={!!e?.prizeAmount}>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs text-muted-foreground">₹</span>
                <Input
                  className="h-8 font-mono"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  aria-label="Prize amount"
                  disabled={readOnly}
                  {...register(`winners.${i}.prizeAmount`)}
                />
              </div>
              <FieldError errors={[e?.prizeAmount]} />
            </Field>
          ) : (
            <div className="text-sm">
              <Money amount={stored?.prize_amount ?? 0} />
              {stored && stored.prize_type !== "cash" && (
                <span className="ml-1 text-xs text-muted-foreground">{PRIZE_TYPE_LABELS[stored.prize_type]}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground md:sr-only">Payment</span>
          {canToggle && <Switch checked={st.paid} onCheckedChange={onPaidChange} aria-label="Paid" />}
          {stored ? <PillBadge ok={st.paid} labelOk="Paid" labelPending="Pending" /> : <NotSavedHint />}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground md:sr-only">Merch</span>
          {prizeType === "cash" && !isAdmin ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <>
              {canToggle && <Switch checked={st.merchSent} onCheckedChange={onMerchSent} aria-label="Merch sent" />}
              {stored && <PillBadge ok={st.merchSent} labelOk="Sent" labelPending="Pending" />}
            </>
          )}
        </div>
        <div className="col-span-2 flex justify-end gap-0.5 md:col-span-1">
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onToggleExpand} aria-expanded={open} aria-label={open ? "Fewer details" : "More details"}>
            <ChevronDownIcon className={cn("transition-transform", open && "rotate-180")} />
          </Button>
          {!locked && (
            <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onDelete} aria-label="Remove winner">
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-3 grid gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field data-invalid={!!e?.email}>
            <FieldLabel htmlFor={`w${i}-email`}>Email</FieldLabel>
            <Input id={`w${i}-email`} type="email" disabled={locked} {...register(`winners.${i}.email`)} />
            <FieldError errors={[e?.email]} />
          </Field>
          <Field data-invalid={!!e?.matiksUsername}>
            <FieldLabel htmlFor={`w${i}-user`}>Matiks username</FieldLabel>
            <Input id={`w${i}-user`} autoCapitalize="none" disabled={locked} {...register(`winners.${i}.matiksUsername`)} />
            <FieldError errors={[e?.matiksUsername]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`w${i}-tshirt`}>T-shirt</FieldLabel>
            <TshirtSelect id={`w${i}-tshirt`} name={`winners.${i}.tshirtSize`} disabled={locked} />
          </Field>
          <Field data-invalid={!!e?.pincode}>
            <FieldLabel htmlFor={`w${i}-pin`}>Pincode</FieldLabel>
            <Input id={`w${i}-pin`} inputMode="numeric" maxLength={6} disabled={locked} {...register(`winners.${i}.pincode`)} />
            <FieldError errors={[e?.pincode]} />
          </Field>
          <Field className="sm:col-span-2 lg:col-span-4">
            <FieldLabel htmlFor={`w${i}-address`}>Address</FieldLabel>
            <Textarea id={`w${i}-address`} rows={2} disabled={locked} {...register(`winners.${i}.address`)} />
          </Field>
          {isAdmin && (
            <>
              <Field>
                <FieldLabel htmlFor={`w${i}-type`}>Prize type</FieldLabel>
                <Controller
                  control={control}
                  name={`winners.${i}.prizeType`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <SelectTrigger id={`w${i}-type`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIZE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {PRIZE_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              {prizeType !== "cash" && (
                <Field className="sm:col-span-1 lg:col-span-3">
                  <FieldLabel htmlFor={`w${i}-merch`}>Merch description</FieldLabel>
                  <Input id={`w${i}-merch`} placeholder="e.g. Matiks hoodie (L)" disabled={readOnly} {...register(`winners.${i}.merchDescription`)} />
                </Field>
              )}
            </>
          )}
          {stored?.payment_status === "paid" && stored.payment_reference && (
            <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
              UTR <span className="font-mono text-foreground">{stored.payment_reference}</span>
              <CopyButton value={stored.payment_reference} label="UTR" className="ml-1 inline-flex" />
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function NotSavedHint() {
  return <span className="text-xs text-muted-foreground italic">save first</span>;
}

export function MarkPaidDialog({
  winner,
  onClose,
  onConfirm,
}: {
  winner: Tables<"winners"> | null;
  onClose: () => void;
  onConfirm: (utr: string) => Promise<string | null>;
}) {
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      open={!!winner}
      onOpenChange={(o) => {
        if (!o) {
          setUtr("");
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            // The dialog is portaled, but React still bubbles submit to the editor's <form>: stop it.
            e.stopPropagation();
            setPending(true);
            setError(await onConfirm(utr));
            setPending(false);
            setUtr("");
          }}
        >
          <DialogHeader>
            <DialogTitle>Mark {winner?.position} paid</DialogTitle>
            <DialogDescription>
              {winner?.name ?? "This winner"} · <Money amount={winner?.prize_amount ?? 0} />
              {winner?.upi_id && <> · UPI <span className="font-mono">{winner.upi_id}</span></>}
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!error} className="my-5">
            <FieldLabel htmlFor="utr">UTR / transaction reference</FieldLabel>
            <Input
              id="utr"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. 427613459812"
              className="font-mono uppercase"
              autoComplete="off"
              autoFocus
            />
            <FieldError>{error}</FieldError>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending || utr.trim().length < 6}>
              {pending ? "Saving…" : "Mark paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
