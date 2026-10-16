"use client";

import { DownloadIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Colleges (the current filtered view), all winners (bulk payments) or all contacts (shipping labels).
 *  Admin writers only; the route re-checks. */
export function ExportMenu() {
  const searchParams = useSearchParams();
  const href = (format: "xlsx" | "csv") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    return `/admin/export?${params}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <DownloadIcon /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Colleges (this view)</DropdownMenuLabel>
        <DownloadItem href={href("xlsx")}>Excel (.xlsx)</DownloadItem>
        <DownloadItem href={href("csv")}>CSV</DownloadItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>All winners · for payments</DropdownMenuLabel>
        <DownloadItem href="/admin/export?kind=winners&format=xlsx">Excel (.xlsx)</DownloadItem>
        <DownloadItem href="/admin/export?kind=winners&format=csv">CSV</DownloadItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>All contacts · for shipping</DropdownMenuLabel>
        <DownloadItem href="/admin/export?kind=contacts&format=xlsx">Excel (.xlsx)</DownloadItem>
        <DownloadItem href="/admin/export?kind=contacts&format=csv">CSV</DownloadItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DownloadItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <DropdownMenuItem asChild>
      <a href={href} download>
        {children}
      </a>
    </DropdownMenuItem>
  );
}
