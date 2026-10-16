import {
  LayoutDashboardIcon,
  MegaphoneIcon,
  ShieldIcon,
  SwordsIcon,
  TrophyIcon,
} from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/admin/ambassadors", label: "Ambassadors", icon: MegaphoneIcon },
  { href: "/admin/leagues", label: "Seasons", icon: TrophyIcon },
  { href: "/admin/matches", label: "Matches", icon: SwordsIcon },
  { href: "/admin/team", label: "Team", icon: ShieldIcon },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

