"use client";

import { CheckCircle2Icon, ChevronRightIcon, CircleIcon, ClockIcon } from "lucide-react";

import type { RegistrationDetail } from "@/lib/data/league-ops";
import type { Stage } from "@/lib/league";
import { cn } from "@/lib/utils";

import type { EditorTab } from "./college-editor";
import type { WinnerStatus } from "./winners-section";

type Item = { label: string; state: "todo" | "waiting" | "done"; tab: EditorTab };

/** What's left for the college, in order; each row opens the tab where it's done. */
export function pocChecklist(detail: RegistrationDetail, stage: Stage, status: (id: string) => WinnerStatus): Item[] {
  const primary = detail.contacts.find((c) => c.is_primary) ?? detail.contacts[0];
  const contactsDone = !!primary && !!(primary.phone && primary.tshirt_size && primary.address && primary.pincode);
  const items: Item[] = [{ label: contactsDone ? "Contact details added" : "Add contact details", state: contactsDone ? "done" : "todo", tab: "contacts" }];

  if (stage !== "registration_phase") {
    const { winners } = detail;
    const winnersDone = winners.length > 0 && winners.every((w) => w.upi_id && w.phone);
    items.push({ label: winnersDone ? "Winners added" : "Add winners", state: winnersDone ? "done" : "todo", tab: "winners" });
    if (winners.length > 0) {
      const unpaid = winners.filter((w) => !status(w.id).paid).length;
      items.push(
        unpaid
          ? { label: `Waiting for payment (${unpaid})`, state: "waiting", tab: "winners" }
          : { label: "Prizes paid", state: "done", tab: "winners" },
      );
    }
  }
  return items;
}

export function PocChecklist({
  detail,
  stage,
  status,
  onOpen,
}: {
  detail: RegistrationDetail;
  stage: Stage;
  status: (id: string) => WinnerStatus;
  onOpen: (tab: EditorTab) => void;
}) {
  const items = pocChecklist(detail, stage, status);
  const left = items.filter((i) => i.state === "todo").length;
  return (
    <section aria-labelledby="checklist-title" className="rounded-2xl border bg-card">
      <h2 id="checklist-title" className="px-4 pt-4 text-2xl">
        {left ? `${left} thing${left === 1 ? "" : "s"} left` : "All set"}
      </h2>
      <ul className="p-2">
        {items.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => {
                onOpen(item.tab);
                document.getElementById("editor-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm transition-colors hover:bg-muted"
            >
              {item.state === "done" ? (
                <CheckCircle2Icon className="size-5 shrink-0 text-primary" />
              ) : item.state === "waiting" ? (
                <ClockIcon className="size-5 shrink-0 text-status-pending-fg" />
              ) : (
                <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
              )}
              <span className={cn("flex-1", item.state === "done" ? "text-muted-foreground" : "font-semibold")}>{item.label}</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
