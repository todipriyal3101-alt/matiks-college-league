import { CheckCircle2Icon, ChevronRightIcon, CircleIcon, ClockIcon } from "lucide-react";
import Link from "next/link";

import { Glass } from "@/components/glass";
import type { Tables } from "@/lib/database.types";
import type { ReviewStatus, Stage } from "@/lib/league";
import { cn } from "@/lib/utils";
import { missingContactDetails } from "@/lib/validation/portal";

type Item = { label: string; state: "todo" | "waiting" | "done"; href: string };

/** What's left for the college after registering, in order; each row links to where it's done. */
export function RegisterChecklist({
  status,
  stage,
  contacts,
  winners,
}: {
  status: ReviewStatus;
  stage: Stage;
  contacts: Pick<Tables<"contacts">, "tshirt_size" | "address" | "pincode">[];
  winners: Pick<Tables<"winners">, "payment_status">[];
}) {
  const contactsDone = contacts.length > 0 && contacts.every((c) => missingContactDetails(c).length === 0);
  const items: Item[] = [
    { label: "Registration submitted", state: "done", href: "#details" },
    {
      label: status === "approved" ? "Approved by Matiks" : status === "rejected" ? "Fix the details and resubmit" : "Waiting for Matiks to approve",
      state: status === "approved" ? "done" : status === "rejected" ? "todo" : "waiting",
      href: "#details",
    },
    {
      label: contactsDone ? "Contact details complete" : "Complete contact details (T-shirt, address, pincode)",
      state: contactsDone ? "done" : "todo",
      href: "#team-contacts",
    },
  ];
  if (status === "approved" && (stage === "ended_prize_pending" || stage === "ended_prize_sent")) {
    items.push({ label: winners.length ? "Winners added" : "Add your winners", state: winners.length ? "done" : "todo", href: "/college/winners" });
  }
  const left = items.filter((i) => i.state === "todo").length;

  return (
    <Glass asChild className="p-2 sm:p-3">
      <section aria-labelledby="checklist-title">
        <h2 id="checklist-title" className="px-3 pt-2 pb-1 text-3xl">
          {left ? `${left} thing${left === 1 ? "" : "s"} to do` : "All set"}
        </h2>
        <ul>
          {items.map((item) => (
            <li key={item.label}>
              <Link href={item.href} className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm transition-colors hover:bg-white/6">
                {item.state === "done" ? (
                  <CheckCircle2Icon className="size-5 shrink-0 text-primary" aria-label="Done" />
                ) : item.state === "waiting" ? (
                  <ClockIcon className="size-5 shrink-0 text-status-pending-fg" aria-label="Waiting" />
                ) : (
                  <CircleIcon className="size-5 shrink-0 text-muted-foreground" aria-label="To do" />
                )}
                <span className={cn("flex-1", item.state === "done" ? "text-muted-foreground" : "font-semibold")}>{item.label}</span>
                <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </Glass>
  );
}
