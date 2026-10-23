"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resubmitMyRegistration, updateMyRegistration } from "@/app/college/actions";
import { DetailsFields, detailsErrors, type DetailsErrors } from "@/components/details-fields";
import { Button } from "@/components/ui/button";
import { registrationDetailsSchema, type DetailsFormValues } from "@/lib/validation/portal";

/** Register tab while pending (edit) or denied (edit + resubmit). The database locks these once approved. */
export function EditDetailsForm({ registrationId, initial, denied }: { registrationId: string; initial: DetailsFormValues; denied: boolean }) {
  const [details, setDetails] = useState(initial);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [saving, startSaving] = useTransition();
  const [resubmitting, startResubmit] = useTransition();
  const dirty = JSON.stringify(details) !== JSON.stringify(initial);

  /** Saves if needed; returns false when validation or the save failed. */
  async function save(): Promise<boolean> {
    const parsed = registrationDetailsSchema.safeParse(details);
    if (!parsed.success) {
      setErrors(detailsErrors(parsed.error.issues));
      toast.error("Fix the highlighted fields");
      return false;
    }
    setErrors({});
    if (!dirty) return true;
    const res = await updateMyRegistration(registrationId, details);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    return true;
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        startSaving(async () => {
          if (await save()) toast.success("Saved");
        });
      }}
      className="space-y-6"
    >
      <DetailsFields idPrefix="reg" folder={`registrations/${registrationId}`} value={details} onChange={setDetails} errors={errors} />
      <div className="flex flex-col gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
        <Button type="submit" variant={denied ? "outline" : "default"} className="h-12 rounded-full px-6" disabled={!dirty || saving || resubmitting}>
          {saving && <Loader2Icon className="animate-spin" />}
          Save changes
        </Button>
        {denied && (
          <Button
            type="button"
            className="h-12 rounded-full px-6"
            disabled={saving || resubmitting}
            onClick={() =>
              startResubmit(async () => {
                if (!(await save())) return;
                const res = await resubmitMyRegistration(registrationId);
                if (!res.ok) toast.error(res.error);
                else toast.success("Sent back for review");
              })
            }
          >
            {resubmitting ? <Loader2Icon className="animate-spin" /> : <RotateCcwIcon />}
            Save and resubmit
          </Button>
        )}
      </div>
    </form>
  );
}
