"use client";

import { DownloadIcon } from "lucide-react";

import { download } from "@/components/admin/command-palette";
import { Button } from "@/components/ui/button";

/** One Excel file (Colleges, POCs, Winners, Participants) for the selected country. Admin writers only; the route re-checks. */
export function ExportAllButton() {
  return (
    <Button variant="outline" className="h-11 rounded-full px-5" onClick={() => download("/admin/export")}>
      <DownloadIcon /> Export all data
    </Button>
  );
}
