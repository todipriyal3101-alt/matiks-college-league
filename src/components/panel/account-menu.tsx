"use client";

import { ChevronDownIcon, LogOutIcon, MegaphoneIcon, ShieldIcon, SwordsIcon, TrophyIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";

import { logout } from "@/lib/auth/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
}

function Trigger({ name, badge }: { name: string; badge?: string }) {
  return (
    <DropdownMenuTrigger
      className="flex h-11 items-center gap-2 rounded-full bg-white/7 py-1 pr-1 pl-1 text-sm font-semibold shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)] outline-none hover:bg-white/12 focus-visible:ring-3 focus-visible:ring-ring/50 sm:pr-3"
      // The spoken name starts with what's visible (the first name); the initials are decorative.
      aria-label={`${name.split(" ")[0]}, account menu`}
    >
      <span aria-hidden className="grid size-9 place-items-center rounded-full bg-lilac text-[13px] font-bold text-background">
        {initials(name)}
      </span>
      <span className="hidden max-w-32 truncate sm:inline">{name.split(" ")[0]}</span>
      {badge && <RoleBadge role={badge} className="hidden lg:inline" />}
      <ChevronDownIcon className="hidden size-4 text-muted-foreground sm:block" />
    </DropdownMenuTrigger>
  );
}

function RoleBadge({ role, className }: { role: string; className?: string }) {
  return (
    <span className={cn("rounded-full bg-olive px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase", className)}>{role}</span>
  );
}

/** Admin: name + "Admin" badge · Manage Admins · league tools · Log out. */
export function AdminAccountMenu({ name, email, role }: { name: string; email: string; role: "admin" | "viewer" }) {
  const label = role === "admin" ? "Admin" : "Viewer";
  return (
    <DropdownMenu>
      <Trigger name={name} badge={label} />
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-1.5 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          <RoleBadge role={label} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/admin/team">
            <ShieldIcon /> Manage Admins
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">League tools</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/admin/leagues">
            <TrophyIcon /> Seasons
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/matches">
            <SwordsIcon /> Matches
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/admin/ambassadors">
            <MegaphoneIcon /> Ambassadors
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** POC: Profile & contacts · Log out. */
export function PocAccountMenu({ name, email }: { name: string; email: string }) {
  return (
    <DropdownMenu>
      <Trigger name={name} />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/college/profile">
            <UserRoundIcon /> Profile &amp; contacts
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOutIcon /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
