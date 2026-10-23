"use client";

import { Loader2Icon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveTeamContacts } from "@/app/college/actions";
import { SectionLabel } from "@/components/details-fields";
import { Glass } from "@/components/glass";
import { ContactFieldsForm, contactErrors } from "@/components/portal/contact-fields";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import {
  contactFieldsFromRow,
  EMPTY_CONTACT_FIELDS,
  missingContactDetails,
  teamContactsSchema,
  type ContactFields,
} from "@/lib/validation/portal";

/**
 * The college's contacts, filled in by the POC: their own (primary) + up to 2 more, same fields. Editable while
 * pending and after approval. Merch status is shown, never edited (admin-only, enforced by the database).
 */
export function TeamContacts({ registrationId, contacts }: { registrationId: string; contacts: Tables<"contacts">[] }) {
  const initial = [...contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary)).map(contactFieldsFromRow);
  const [list, setList] = useState<ContactFields[]>(initial);
  const [issues, setIssues] = useState<{ path: PropertyKey[]; message: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [seen, setSeen] = useState(contacts);
  if (seen !== contacts) {
    // Fresh data after a save: take it.
    setSeen(contacts);
    setList(initial);
  }
  const dirty = JSON.stringify(list) !== JSON.stringify(initial);
  const stored = (id?: string) => contacts.find((c) => c.id === id);

  function save() {
    const parsed = teamContactsSchema.safeParse(list);
    if (!parsed.success) {
      setIssues(parsed.error.issues);
      toast.error("Fix the highlighted fields");
      return;
    }
    setIssues([]);
    startTransition(async () => {
      const res = await saveTeamContacts(registrationId, list);
      if (!res.ok) toast.error(res.error);
      else toast.success("Contacts saved");
    });
  }

  return (
    <section id="team-contacts" className="scroll-mt-28 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-4xl">Team contacts</h2>
          <p className="text-sm text-muted-foreground">You + up to 2 more. We ship merch to these addresses.</p>
        </div>
        {list.length < 3 && (
          <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => setList([...list, { ...EMPTY_CONTACT_FIELDS }])}>
            <PlusIcon /> Add contact
          </Button>
        )}
      </div>

      {list.map((c, i) => {
        const row = stored(c.id);
        const isPrimary = row ? row.is_primary : false;
        const missing = row ? missingContactDetails(row) : [];
        return (
          <Glass key={c.id ?? `new-${i}`} className="space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <SectionLabel>
                <span className="inline-flex items-center gap-1.5">
                  {isPrimary && <StarIcon className="size-3.5 fill-primary text-primary" aria-hidden />}
                  {isPrimary ? "Primary contact (you)" : c.id ? `Contact ${i + 1}` : "New contact"}
                </span>
              </SectionLabel>
              <div className="flex items-center gap-2">
                {missing.length > 0 && (
                  <span className="rounded-full bg-status-pending px-2.5 py-0.5 text-xs font-semibold text-status-pending-fg">
                    Missing: {missing.join(", ")}
                  </span>
                )}
                {!isPrimary && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-full"
                    aria-label={`Remove ${c.name || "this contact"}`}
                    onClick={() => setList(list.filter((_, j) => j !== i))}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>
            </div>
            <ContactFieldsForm
              idPrefix={`tc${i}`}
              value={c}
              onChange={(next) => setList(list.map((x, j) => (j === i ? next : x)))}
              errors={contactErrors(issues, [i])}
            />
            {row?.merch_description && (
              <p className={cn("rounded-xl px-3 py-2 text-sm", row.merch_sent ? "bg-status-live text-status-live-fg" : "bg-white/5 text-foreground/85")}>
                Merch from Matiks: {row.merch_description} · {row.merch_sent ? "sent" : "on its way soon"}
              </p>
            )}
          </Glass>
        );
      })}

      <div className="flex justify-end">
        <Button type="button" className="h-12 rounded-full px-7" disabled={!dirty || pending} onClick={save}>
          {pending && <Loader2Icon className="animate-spin" />}
          Save contacts
        </Button>
      </div>
    </section>
  );
}
