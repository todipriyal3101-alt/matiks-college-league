"use client";

import {
  DownloadIcon,
  LineChartIcon,
  LinkIcon,
  Loader2Icon,
  SchoolIcon,
  SearchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  paletteColleges,
  type PaletteCollege,
} from "@/app/admin/(panel)/actions";
import { ADMIN_NAV } from "@/components/admin/nav-items";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { REVIEW_LABELS, type ReviewStatus } from "@/lib/league";

/** Ctrl/⌘+K: jump to a college of the selected season, a page, or run an action. */
export function CommandPalette({ isWriter }: { isWriter: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [colleges, setColleges] = useState<PaletteCollege[] | null>(null);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fresh list every time it opens (new registrations arrive all the time).
  useEffect(() => {
    if (!open) return;
    startLoading(async () => setColleges(await paletteColleges()));
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="text-muted-foreground max-sm:size-8 max-sm:px-0"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] lg:inline">
          ⌘K
        </kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Jump to a college, a page or an action"
      >
        <Command>
          <CommandInput placeholder="Search colleges, pages, actions…" />
          <CommandList>
            <CommandEmpty>
              {loading ? "Loading…" : "Nothing found."}
            </CommandEmpty>
            <CommandGroup heading="Colleges this season">
              {loading && !colleges && (
                <CommandItem disabled>
                  <Loader2Icon className="animate-spin" /> Loading colleges…
                </CommandItem>
              )}
              {colleges?.map((c) => (
                <CommandItem
                  key={c.registrationId}
                  value={`${c.name} ${c.city ?? ""} ${c.registrationId}`}
                  onSelect={() =>
                    run(() =>
                      router.push(`/admin/colleges/${c.registrationId}`),
                    )
                  }
                >
                  <SchoolIcon />
                  <span className="truncate">{c.name}</span>
                  {c.city && (
                    <span className="truncate text-xs text-muted-foreground">
                      {c.city}
                    </span>
                  )}
                  <CommandShortcut>
                    {REVIEW_LABELS[c.status as ReviewStatus] ?? c.status}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
                <CommandItem
                  key={href}
                  value={`page ${label}`}
                  onSelect={() => run(() => router.push(href))}
                >
                  <Icon /> {label}
                </CommandItem>
              ))}
              <CommandItem
                value="page insights charts"
                onSelect={() => run(() => router.push("/admin?tab=insights"))}
              >
                <LineChartIcon /> Insights
              </CommandItem>
              <CommandItem
                value="page pending review"
                onSelect={() => run(() => router.push("/admin?review=pending"))}
              >
                <SchoolIcon /> Pending review
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {isWriter && (
                <>
                  <CommandItem
                    value="export excel xlsx"
                    onSelect={() =>
                      run(() =>
                        window.location.assign("/admin/export?format=xlsx"),
                      )
                    }
                  >
                    <DownloadIcon /> Export all to Excel
                  </CommandItem>
                  <CommandItem
                    value="export csv"
                    onSelect={() =>
                      run(() =>
                        window.location.assign("/admin/export?format=csv"),
                      )
                    }
                  >
                    <DownloadIcon /> Export all to CSV
                  </CommandItem>
                </>
              )}
              <CommandItem
                value="copy registration link"
                onSelect={() =>
                  run(async () => {
                    try {
                      await navigator.clipboard.writeText(
                        `${window.location.origin}/register`,
                      );
                      toast.success("Registration link copied");
                    } catch {
                      toast.error("Couldn't copy the link.");
                    }
                  })
                }
              >
                <LinkIcon /> Copy registration link
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
