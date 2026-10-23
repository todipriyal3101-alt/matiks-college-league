"use client";

import {
  ClipboardPenIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  SearchIcon,
  TrophyIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Glass } from "@/components/glass";
import { Logo } from "@/components/league/logo";
import { useChatUnread } from "@/components/panel/use-chat-unread";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean; chats?: boolean };

const ADMIN_ITEMS: Item[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboardIcon,
    // Overview also owns the colleges list and editors; Manage Admins / More pages keep it highlighted too.
    match: (p) => !/^\/admin\/(search|chats|pocs)(\/|$)/.test(p),
  },
  { href: "/admin/search", label: "Search", icon: SearchIcon, match: (p) => p.startsWith("/admin/search") },
  { href: "/admin/chats", label: "Chats", icon: MessageCircleIcon, match: (p) => p.startsWith("/admin/chats"), chats: true },
  { href: "/admin/pocs", label: "POCs", icon: UsersIcon, match: (p) => p.startsWith("/admin/pocs") },
];

const POC_ITEMS: Item[] = [
  { href: "/college", label: "Register", icon: ClipboardPenIcon, match: (p) => p === "/college" },
  { href: "/college/chat", label: "Chat", icon: MessageCircleIcon, match: (p) => p.startsWith("/college/chat"), chats: true },
  { href: "/college/winners", label: "Winners", icon: TrophyIcon, match: (p) => p.startsWith("/college/winners") },
];

/**
 * The floating glass pill nav (both panels). Phones: logo + actions on top, tabs in a glass tab bar at the bottom.
 * `actions` is the bell + account menu, rendered by the server layout.
 */
export function PanelNav({ panel, actions }: { panel: "admin" | "poc"; actions: React.ReactNode }) {
  const pathname = usePathname();
  const items = panel === "admin" ? ADMIN_ITEMS : POC_ITEMS;
  const unread = useChatUnread();
  const home = panel === "admin" ? "/admin" : "/college";

  return (
    <>
      <header className="sticky top-3 z-40 px-4">
        <Glass asChild variant="pill" refract>
          <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center gap-2 pr-1.5 pl-4 sm:h-15 sm:pl-5">
            <Link href={home} className="mr-auto shrink-0 md:mr-0" aria-label="Matiks College League home">
              <Logo />
            </Link>
            <ul className="mx-auto hidden items-center gap-0.5 rounded-full bg-black/25 p-1 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] md:flex">
              {items.map((item) => (
                <li key={item.href}>
                  <TabLink item={item} active={item.match(pathname)} unread={item.chats ? unread : 0} />
                </li>
              ))}
            </ul>
            <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
          </nav>
        </Glass>
      </header>

      <Glass asChild variant="pill" refract>
        <nav
          aria-label="Main"
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 flex h-16 items-stretch gap-1 p-1.5 md:hidden"
        >
          {items.map((item) => {
            const active = item.match(pathname);
            const count = item.chats ? unread : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold text-foreground/80 transition-colors",
                  active && "bg-white/14 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] [&_svg]:text-primary",
                )}
              >
                <item.icon className="size-5" aria-hidden />
                {item.label}
                {count > 0 && <UnreadDot count={count} className="absolute top-1 left-[calc(50%+4px)]" />}
              </Link>
            );
          })}
        </nav>
      </Glass>
    </>
  );
}

function TabLink({ item, active, unread }: { item: Item; active: boolean; unread: number }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-foreground/80 transition-colors hover:text-foreground",
        active && "bg-white/14 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_2px_10px_rgb(0_0_0/0.25)]",
      )}
    >
      {item.label}
      {item.href === "/admin/search" && <kbd className="hidden font-mono text-[10px] text-muted-foreground lg:inline">⌘K</kbd>}
      {unread > 0 && <UnreadDot count={unread} />}
    </Link>
  );
}

export function UnreadDot({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn(
        "grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground",
        className,
      )}
    >
      <span className="sr-only">, unread: </span>
      {count > 99 ? "99+" : count}
    </span>
  );
}
