"use client";

import { ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, ImageDownIcon } from "lucide-react";

import { download } from "@/components/admin/command-palette";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/**
 * "Export all data" for the selected country: one Excel file (Colleges, POCs, Winners, Participants; admin writers
 * only) or every college's logos as a ZIP (admins and viewers). The routes re-check the role.
 */
export function ExportAllButton({ isWriter }: { isWriter: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 rounded-full px-5">
          <DownloadIcon /> Export all data <ChevronDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {isWriter && (
          <DropdownMenuItem onSelect={() => download("/admin/export")}>
            <FileSpreadsheetIcon /> All data (Excel)
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => download("/admin/logos?all=1")}>
          <ImageDownIcon /> Download all logos (ZIP)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
