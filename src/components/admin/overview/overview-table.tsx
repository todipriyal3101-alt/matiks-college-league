"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table";
import { CheckIcon, ChevronDownIcon, Loader2Icon, MailPlusIcon, SearchXIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { approveAndInvite, restoreRegistrations, setReviewStatus, setStage } from "@/app/admin/(panel)/overview-actions";
import { RowActions } from "@/components/admin/overview/row-actions";
import { ReviewBadge, StageBadge } from "@/components/league/badges";
import { EmptyState } from "@/components/league/empty-state";
import { Money } from "@/components/league/money";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { OverviewRow } from "@/lib/data/league-ops";
import { REVIEW_LABELS, STAGE_LABELS, STAGES, type ReviewStatus, type Stage } from "@/lib/league";
import { cn } from "@/lib/utils";

// Fewer columns on smaller desktops: the rest is one click away in the college.
const COLUMN_CLASS: Record<string, string> = {
  participants: "hidden xl:table-cell",
  poc: "hidden lg:table-cell",
  merch: "hidden xl:table-cell",
  source: "hidden xl:table-cell",
};

type Patch = { ids: string[]; status?: ReviewStatus; stage?: Stage };

export function OverviewTable({
  rows,
  isWriter,
  pocEmails,
  matches = {},
}: {
  rows: OverviewRow[];
  isWriter: boolean;
  /** registration id → winners/contacts that matched the search. */
  matches?: Record<string, string[]>;
  /** registration id → the email the college registered with (admin-only data). */
  pocEmails: Record<string, string>;
}) {
  // Optimistic overrides on top of the server rows; cleared whenever fresh rows arrive (refresh()).
  const [overrides, setOverrides] = useState<Patch[]>([]);
  const [seenRows, setSeenRows] = useState(rows);
  if (seenRows !== rows) {
    setSeenRows(rows);
    setOverrides([]);
  }
  // Deleted rows disappear at once, before the refreshed server rows arrive.
  const [removed, setRemoved] = useState<string[]>([]);
  const optimisticRows = useMemo(
    () => overrides.reduce(applyPatch, rows).filter((r) => !removed.includes(r.registration_id!)),
    [rows, overrides, removed],
  );
  const router = useRouter();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [bulkApprove, setBulkApprove] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Optimistic status/stage change with an Undo toast. */
  function change(patch: Patch) {
    const label = patch.status ? REVIEW_LABELS[patch.status] : STAGE_LABELS[patch.stage!];
    const what = patch.ids.length === 1 ? (rows.find((r) => r.registration_id === patch.ids[0])?.college_name ?? "College") : `${patch.ids.length} colleges`;
    setOverrides((o) => [...o, patch]);
    startTransition(async () => {
      const res = patch.status ? await setReviewStatus(patch.ids, patch.status) : await setStage(patch.ids, patch.stage!);
      if (!res.ok) {
        setOverrides((o) => o.filter((p) => p !== patch));
        toast.error(res.error);
        return;
      }
      setSelection({});
      toast.success(patch.ids.length === 1 ? label : `${what}: ${label}`, {
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undo = await restoreRegistrations(res.previous);
              if (!undo.ok) toast.error(undo.error);
            }),
        },
      });
    });
  }

  function remove(id: string) {
    setRemoved((ids) => [...ids, id]);
    setSelection((sel) => Object.fromEntries(Object.entries(sel).filter(([key]) => key !== id)));
  }

  const columns: ColumnDef<OverviewRow>[] = [
    ...(isWriter
      ? [
          {
            id: "select",
            header: ({ table }) => (
              <Checkbox
                checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
                onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
                aria-label="Select all"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(v) => row.toggleSelected(v === true)}
                aria-label={`Select ${row.original.college_name}`}
              />
            ),
          } satisfies ColumnDef<OverviewRow>,
        ]
      : []),
    {
      id: "college",
      header: "College",
      cell: ({ row: { original: r } }) => (
        <div className="min-w-44">
          <Link href={`/admin/colleges/${r.registration_id}`} className="font-medium hover:text-primary">
            {r.college_name}
          </Link>
          <div className="text-xs text-muted-foreground">{[r.city, r.state].filter(Boolean).join(", ")}</div>
          <PeopleMatch names={matches[r.registration_id!]} />
        </div>
      ),
    },
    { id: "review", header: "Review", cell: ({ row }) => <ReviewBadge status={row.original.review_status!} /> },
    { id: "stage", header: "Stage", cell: ({ row }) => <StageBadge stage={row.original.stage!} /> },
    {
      id: "participants",
      header: () => <div className="text-right">Participants</div>,
      cell: ({ row }) => <div className="text-right font-mono tabular-nums">{row.original.participant_count}</div>,
    },
    {
      id: "prize",
      header: () => <div className="text-right">Prize pool</div>,
      cell: ({ row: { original: r } }) => (
        <div className="text-right whitespace-nowrap">
          <Money amount={r.prize_pool} />
          {r.prize_pool_override != null && <span className="ml-1 text-[10px] text-primary uppercase">override</span>}
        </div>
      ),
    },
    {
      id: "poc",
      header: "Primary POC",
      cell: ({ row }) => row.original.primary_poc_name ?? <span className="text-muted-foreground italic">not set</span>,
    },
    { id: "winners", header: "Winners paid", cell: ({ row: { original: r } }) => <Ratio done={r.winners_paid} total={r.winners_total} /> },
    { id: "merch", header: "POC merch", cell: ({ row: { original: r } }) => <Ratio done={r.contacts_merch_sent} total={r.contacts_total} /> },
    {
      id: "source",
      header: "Source",
      cell: ({ row: { original: r } }) => (
        <div className="text-xs">
          <div>{r.utm_source ?? <span className="text-muted-foreground">direct</span>}</div>
          {r.referral_code && <div className="font-mono text-muted-foreground">ref {r.referral_code}</div>}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row: { original: r } }) => (
        <div className="text-right">
          <RowActions
            registrationId={r.registration_id!}
            collegeName={r.college_name!}
            reviewStatus={r.review_status!}
            pocEmail={pocEmails[r.registration_id!] ?? ""}
            isWriter={isWriter}
            onReview={(status) => change({ ids: [r.registration_id!], status })}
            onDeleted={() => remove(r.registration_id!)}
          />
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: optimisticRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.registration_id!,
    state: { rowSelection: selection },
    onRowSelectionChange: setSelection,
    enableRowSelection: isWriter,
  });

  const selectedIds = Object.keys(selection).filter((id) => selection[id]);

  /** Row click opens the college, unless the click was on a control inside the row. */
  function openRow(e: React.MouseEvent, registrationId: string) {
    if ((e.target as HTMLElement).closest("a, button, input, label, [role=checkbox], [role=menu], [role=menuitem], [data-slot=dialog-content]")) return;
    router.push(`/admin/colleges/${registrationId}`);
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={SearchXIcon}
        title="No colleges match these filters"
        description="Try another search or clear the filters."
      />
    );
  }

  return (
    <div className={cn("space-y-3", pending && "opacity-90")}>
      {isWriter && selectedIds.length > 0 && (
        <BulkBar
          count={selectedIds.length}
          onClear={() => setSelection({})}
          onReview={(status) => (status === "approved" ? setBulkApprove(true) : change({ ids: selectedIds, status }))}
          onStage={(stage) => change({ ids: selectedIds, stage })}
        />
      )}
      <BulkApproveDialog
        open={bulkApprove}
        onOpenChange={setBulkApprove}
        count={selectedIds.length}
        onApproveOnly={() => {
          setBulkApprove(false);
          change({ ids: selectedIds, status: "approved" });
        }}
        onApproveAndInvite={async () => {
          const res = await approveAndInvite(selectedIds);
          if (!res.ok) return toast.error(res.error);
          setSelection({});
          setBulkApprove(false);
          if (res.failed.length) toast.warning(res.message, { description: res.failed.join("\n"), duration: 15000 });
          else toast.success(res.message);
        }}
      />

      {/* Desktop table */}
      <div className="relative hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs tracking-wider text-muted-foreground uppercase">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={cn("px-3 py-2.5 text-left font-semibold whitespace-nowrap", COLUMN_CLASS[h.column.id])}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={(e) => openRow(e, row.original.registration_id!)}
                className="cursor-pointer border-t border-border/60 transition-colors hover:bg-accent/40 data-[state=selected]:bg-accent/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cn("px-3 py-2 align-middle", COLUMN_CLASS[cell.column.id])}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {table.getRowModel().rows.map((row) => {
          const r = row.original;
          return (
            <li
              key={row.id}
              onClick={(e) => openRow(e, r.registration_id!)}
              className={cn("cursor-pointer rounded-2xl border bg-card p-4 transition-colors active:bg-accent/40", row.getIsSelected() && "border-primary/50 bg-accent/30")}
            >
              <div className="flex items-start gap-3">
                {isWriter && (
                  <Checkbox
                    className="mt-1"
                    checked={row.getIsSelected()}
                    onCheckedChange={(v) => row.toggleSelected(v === true)}
                    aria-label={`Select ${r.college_name}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/colleges/${r.registration_id}`} className="font-medium hover:text-primary">
                    {r.college_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {[r.city, r.state].filter(Boolean).join(", ")} · {r.primary_poc_name ?? "no POC"}
                  </div>
                  <PeopleMatch names={matches[r.registration_id!]} />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <ReviewBadge status={r.review_status!} />
                    <StageBadge stage={r.stage!} />
                  </div>
                </div>
                <RowActions
                  registrationId={r.registration_id!}
                  collegeName={r.college_name!}
                  reviewStatus={r.review_status!}
                  pocEmail={pocEmails[r.registration_id!] ?? ""}
                  isWriter={isWriter}
                  onReview={(status) => change({ ids: [r.registration_id!], status })}
                  onDeleted={() => remove(r.registration_id!)}
                />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
                <Stat label="Participants">
                  <span className="font-mono">{r.participant_count}</span>
                </Stat>
                <Stat label="Prize pool">
                  <Money amount={r.prize_pool} />
                  {r.prize_pool_override != null && <span className="ml-1 text-[9px] text-primary uppercase">ovr</span>}
                </Stat>
                <Stat label="Winners paid">
                  <Ratio done={r.winners_paid} total={r.winners_total} />
                </Stat>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PeopleMatch({ names }: { names?: string[] }) {
  if (!names?.length) return null;
  return <div className="mt-0.5 text-xs text-primary">Matches {names.join(", ")}</div>;
}

function applyPatch(rows: OverviewRow[], patch: Patch): OverviewRow[] {
  return rows.map((r) =>
    patch.ids.includes(r.registration_id!)
      ? { ...r, review_status: patch.status ?? r.review_status, stage: patch.stage ?? r.stage }
      : r,
  );
}

function Ratio({ done, total }: { done: number | null; total: number | null }) {
  const d = done ?? 0;
  const t = total ?? 0;
  return (
    <span className={cn("font-mono text-xs tabular-nums", t > 0 && d === t ? "text-status-live-fg" : "text-muted-foreground")}>
      {d}/{t}
    </span>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function BulkBar({
  count,
  onClear,
  onReview,
  onStage,
}: {
  count: number;
  onClear: () => void;
  onReview: (status: ReviewStatus) => void;
  onStage: (stage: Stage) => void;
}) {
  return (
    <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-card/95 p-2 pl-4 shadow-lg backdrop-blur">
      <span className="mr-auto text-sm font-medium">{count} selected</span>
      <Button size="sm" onClick={() => onReview("approved")}>
        <CheckIcon /> Approve
      </Button>
      <Button size="sm" variant="destructive" onClick={() => onReview("rejected")}>
        <XIcon /> Reject
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Change stage <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STAGES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => onStage(s)}>
              {STAGE_LABELS[s]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Clear selection">
        <XIcon />
      </Button>
    </div>
  );
}

/** Bulk Approve: invite each POC (the default; sign-ups are off, so POCs log in only once invited) or approve only. */
function BulkApproveDialog({
  open,
  onOpenChange,
  count,
  onApproveOnly,
  onApproveAndInvite,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onApproveOnly: () => void;
  onApproveAndInvite: () => Promise<unknown>;
}) {
  const [pending, startTransition] = useTransition();
  const plural = count === 1 ? "" : "s";
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Approve {count} college{plural}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Invite sends each POC an email to manage their college at /college, using the email they registered with.
            POCs can&apos;t log in until they&apos;re invited.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="outline" disabled={pending} onClick={onApproveOnly}>
            Approve only
          </Button>
          <Button disabled={pending} onClick={() => startTransition(async () => void (await onApproveAndInvite()))}>
            {pending ? <Loader2Icon className="animate-spin" /> : <MailPlusIcon />}
            Approve + invite POC{plural}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
