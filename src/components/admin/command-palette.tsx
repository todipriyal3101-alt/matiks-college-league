"use client";

import {
  BuildingIcon,
  DownloadIcon,
  LayoutDashboardIcon,
  LinkIcon,
  Loader2Icon,
  MegaphoneIcon,
  MessageCircleIcon,
  SchoolIcon,
  SearchIcon,
  SparklesIcon,
  ShieldIcon,
  SwordsIcon,
  TrophyIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { paletteData, type PaletteCollege } from "@/app/admin/(panel)/actions";
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
import type { PersonHit } from "@/lib/data/people";
import { REVIEW_LABELS, type ReviewStatus } from "@/lib/league";

const PAGES = [
  { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/admin/colleges", label: "All registered colleges", icon: BuildingIcon },
  { href: "/admin/colleges?status=pending", label: "Pending review", icon: SchoolIcon },
  { href: "/admin/search", label: "Search", icon: SearchIcon },
  { href: "/admin/chats", label: "Chats", icon: MessageCircleIcon },
  { href: "/admin/pocs", label: "POCs", icon: UsersIcon },
  { href: "/admin/team", label: "Manage Admins", icon: ShieldIcon },
  { href: "/admin/leagues", label: "Seasons", icon: TrophyIcon },
  { href: "/admin/matches", label: "Matches", icon: SwordsIcon },
  { href: "/admin/ambassadors", label: "Ambassadors", icon: MegaphoneIcon },
  { href: "/admin/growth", label: "Growth (invites + duels)", icon: SparklesIcon },
] as const;

/** File download from a route handler (not a page navigation). */
export function download(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  a.click();
}

/** Ctrl/⌘+K anywhere in admin: jump to a college, a POC or winner, a page, or run an action. */
export function CommandPalette({ isWriter }: { isWriter: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [colleges, setColleges] = useState<PaletteCollege[] | null>(null);
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [query, setQuery] = useState("");
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // e.key is undefined for some synthetic keydowns (e.g. Chrome autofill).
      if (e.key?.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
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
    startLoading(async () => {
      const data = await paletteData();
      setColleges(data.colleges);
      setPeople(data.people);
    });
  }, [open]);

  function run(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a college, a person, a page or an action">
      <Command>
        <CommandInput placeholder="Search colleges, POCs, winners, phones, emails…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{loading ? "Loading…" : "Nothing found."}</CommandEmpty>
          <CommandGroup heading="Colleges">
            {loading && !colleges && (
              <CommandItem disabled>
                <Loader2Icon className="animate-spin" /> Loading colleges…
              </CommandItem>
            )}
            {colleges?.map((c) => (
              <CommandItem
                key={c.registrationId}
                value={`${c.name} ${c.city ?? ""} ${c.registrationId}`}
                onSelect={() => run(() => router.push(`/admin/colleges/${c.registrationId}`))}
              >
                <SchoolIcon />
                <span className="truncate">{c.name}</span>
                {c.league && <span className="truncate text-xs text-muted-foreground">{c.league}</span>}
                <CommandShortcut>{REVIEW_LABELS[c.status as ReviewStatus] ?? c.status}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
          {/* People only once something is typed: hundreds of names would bury the colleges. */}
          {query.trim().length >= 2 && people.length > 0 && (
            <CommandGroup heading="POCs & winners">
              {people.map((p, i) => (
                <CommandItem
                  key={`${p.kind}-${p.registrationId}-${i}`}
                  value={`person ${p.name} ${p.phone ?? ""} ${p.email ?? ""} ${p.college} ${p.registrationId}-${i}`}
                  onSelect={() =>
                    run(() => router.push(`/admin/colleges/${p.registrationId}?tab=${p.kind === "winner" ? "winners" : "contacts"}`))
                  }
                >
                  {p.kind === "winner" ? <TrophyIcon /> : <UserIcon />}
                  <span className="truncate">{p.name || p.phone || p.email}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {p.detail} · {p.college}
                  </span>
                  {p.phone && <CommandShortcut className="font-mono">{p.phone}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Pages">
            {PAGES.map(({ href, label, icon: Icon }) => (
              <CommandItem key={href} value={`page ${label}`} onSelect={() => run(() => router.push(href))}>
                <Icon /> {label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            {isWriter && (
              <CommandItem value="export all data excel xlsx winners contacts participants" onSelect={() => run(() => download("/admin/export"))}>
                <DownloadIcon /> Export all data (Excel)
              </CommandItem>
            )}
            <CommandItem
              value="copy sign up link poc register"
              onSelect={() =>
                run(async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/login?mode=signup`);
                    toast.success("Sign-up link copied");
                  } catch {
                    toast.error("Couldn't copy the link.");
                  }
                })
              }
            >
              <LinkIcon /> Copy POC sign-up link
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
