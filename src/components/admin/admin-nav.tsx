"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV, isActive } from "@/components/admin/nav-items";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Desktop sidebar links, with the current page highlighted (reads the URL, so render inside <Suspense>). */
export function AdminSidebarNav() {
  return <SidebarLinks pathname={usePathname()} />;
}

/** Same links without a highlight: the Suspense fallback while the URL is read. */
export function AdminSidebarNavFallback() {
  return <SidebarLinks pathname={null} />;
}

function SidebarLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            pathname && isActive(pathname, href) && "bg-accent font-medium text-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Small-screen menu in the top bar. */
export function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <MenuIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild className={cn(isActive(pathname, href) && "font-medium")}>
            <Link href={href}>
              <Icon />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
