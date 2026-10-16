"use client";

import { AlertTriangleIcon, GitMergeIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { CollegeSearch } from "@/components/register/college-search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import type { CollegeSearchResult } from "@/lib/data/colleges";
import { mergeColleges, previewMerge, type MergePreview } from "@/lib/league-ops/merge-actions";

/** "Merge into…": this college is the duplicate; the admin picks the college to keep. */
export function MergeDialog({
  open,
  onOpenChange,
  collegeId,
  collegeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collegeId: string;
  collegeName: string;
}) {
  const [picked, setPicked] = useState<CollegeSearchResult | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [merging, startMerging] = useTransition();

  function reset() {
    setPicked(null);
    setPreview(null);
    setError(null);
  }

  function pick(college: CollegeSearchResult) {
    setPicked(college);
    setPreview(null);
    setError(null);
    if (college.id === collegeId) return setError("That's this college. Pick the one to keep.");
    startLoading(async () => {
      const res = await previewMerge(college.id, collegeId);
      if (!res.ok) return setError(res.error);
      setPreview(res.preview);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Merge into…</DialogTitle>
          <DialogDescription>
            {collegeName} is a duplicate. Pick the college to keep; everything moves there and {collegeName} is deleted.
          </DialogDescription>
        </DialogHeader>

        <Field>
          <FieldLabel htmlFor="merge-search">College to keep</FieldLabel>
          <CollegeSearch
            id="merge-search"
            placeholder="Search all colleges"
            selectedId={picked?.id ?? null}
            selectedLabel={picked?.name ?? ""}
            onSelect={pick}
            onQueryChange={() => picked && reset()}
          />
        </Field>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Checking what moves…
          </p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {preview && (
          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/40 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">Keep</span> <strong>{preview.keep.name}</strong>
              {(preview.keep.city || preview.keep.state) && (
                <span className="text-muted-foreground"> · {[preview.keep.city, preview.keep.state].filter(Boolean).join(", ")}</span>
              )}
            </p>
            <ul className="space-y-1">
              <li>
                <span className="font-mono">{preview.registrations.length}</span> season registration
                {preview.registrations.length === 1 ? "" : "s"}
                {preview.registrations.length > 0 && <span className="text-muted-foreground"> ({preview.registrations.join(", ")})</span>}
              </li>
              <li>
                <span className="font-mono">{preview.matches}</span> match{preview.matches === 1 ? "" : "es"}
              </li>
              <li>
                <span className="font-mono">{preview.ambassadors}</span> ambassador{preview.ambassadors === 1 ? "" : "s"}
              </li>
            </ul>
            <p className="text-muted-foreground">
              Empty details on {preview.keep.name} (city, website, logo…) are filled from {preview.duplicate.name}. Then{" "}
              {preview.duplicate.name} is deleted. This can&apos;t be undone.
            </p>
            {preview.blocked && (
              <p className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                {preview.blocked}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!preview || !!preview.blocked || merging}
            onClick={() =>
              startMerging(async () => {
                const res = await mergeColleges(preview!.keep.id, collegeId);
                if (!res.ok) return setError(res.error);
                toast.success(res.message);
                reset();
                onOpenChange(false);
              })
            }
          >
            {merging ? <Loader2Icon className="animate-spin" /> : <GitMergeIcon />}
            Merge and delete duplicate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
