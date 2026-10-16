import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { getAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { filterOverview, getOverview, type OverviewRow } from "@/lib/data/league-ops";
import { REVIEW_LABELS, STAGE_LABELS } from "@/lib/league";
import { parseOverviewFilters } from "@/lib/validation/league-ops";

// Export the League Overview's current filtered view (same filters as the URL). Admin writers only:
// viewers can read but never export (CLAUDE.md rule 4).
export async function GET(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Not logged in", { status: 401 });
  if (!admin.isWriter) return new NextResponse("Viewers can't export", { status: 403 });

  const league = await getSelectedLeague();
  if (!league) return new NextResponse("No season selected", { status: 404 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = params.format === "csv" ? "csv" : "xlsx";
  const rows = filterOverview(await getOverview(league.id), parseOverviewFilters(params)).map(toExportRow);

  const sheet = XLSX.utils.json_to_sheet(rows);
  const slug = `${league.name}-colleges-${new Date().toISOString().slice(0, 10)}`.replace(/[^\w.-]+/g, "-").toLowerCase();
  const headers = { "Cache-Control": "no-store" };

  if (format === "csv") {
    // BOM so Excel opens ₹ and Indian names correctly.
    const csv = "﻿" + XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.csv"` },
    });
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Colleges");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}.xlsx"`,
    },
  });
}

/** Text a spreadsheet would treat as a formula gets a leading apostrophe (CSV/formula injection). */
function safe(value: string | null | undefined) {
  if (!value) return "";
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function toExportRow(r: OverviewRow) {
  return {
    College: safe(r.college_name),
    City: safe(r.city),
    State: safe(r.state),
    Team: safe(r.team_name),
    "Review status": r.review_status ? REVIEW_LABELS[r.review_status] : "",
    Stage: r.stage ? STAGE_LABELS[r.stage] : "",
    Participants: r.participant_count ?? 0,
    "Auto tier (₹)": r.auto_prize_pool ?? 0,
    "Override (₹)": r.prize_pool_override ?? "",
    "Prize pool (₹)": r.prize_pool ?? 0,
    "Primary POC": safe(r.primary_poc_name),
    "Winners paid": r.winners_paid ?? 0,
    "Winners total": r.winners_total ?? 0,
    "Prize paid (₹)": r.prize_paid_amount ?? 0,
    "POC merch sent": r.contacts_merch_sent ?? 0,
    "POC contacts": r.contacts_total ?? 0,
    Source: safe(r.utm_source ?? "direct"),
    "Referral code": safe(r.referral_code),
    "Registered at": r.created_at ? new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
  };
}
