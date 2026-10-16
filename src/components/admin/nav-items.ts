import {
  ClipboardListIcon,
  GraduationCapIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  ShieldIcon,
  SwordsIcon,
  TrophyIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";

export const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/admin/registrations", label: "Registrations", icon: ClipboardListIcon },
  { href: "/admin/colleges", label: "Colleges", icon: GraduationCapIcon },
  { href: "/admin/participants", label: "Participants", icon: UsersIcon },
  { href: "/admin/ambassadors", label: "Ambassadors", icon: MegaphoneIcon },
  { href: "/admin/leagues", label: "Leagues", icon: TrophyIcon },
  { href: "/admin/matches", label: "Matches", icon: SwordsIcon },
  { href: "/admin/team", label: "Team", icon: ShieldIcon },
  { href: "/admin/import", label: "Import", icon: UploadIcon },
] as const;

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

