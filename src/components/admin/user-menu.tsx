"use client";

import { LogOutIcon, UserIcon } from "lucide-react";

import { logout } from "@/lib/auth/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminProfile } from "@/lib/auth/admin";

export function UserMenu({ profile }: { profile: AdminProfile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <UserIcon />
          <span className="hidden max-w-40 truncate sm:inline">{profile.name ?? profile.email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-medium">{profile.name ?? "Admin"}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{profile.email}</p>
          <Badge variant={profile.role === "admin" ? "default" : "secondary"}>{profile.role}</Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
