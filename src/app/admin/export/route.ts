import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { getAdmin } from "@/lib/auth/admin";
import { getSelectedLeague } from "@/lib/data/admin-leagues";
import { filterOverview, getOverview, type OverviewRow } from "@/lib/data/league-ops";
import { getSeasonContacts, getSeasonPeople, getSeasonWinners, matchPeople } from "@/lib/data/people";
import { REVIEW_LABELS, STAGE_LABELS } from "@/lib/league";
import { parseOverviewFilters } from "@/lib/validation/league-ops";

// Exports for the selected season. Admin writers only: viewers can read but never export (CLAUDE.md rule 4).
// kind=colleges (default): the League Overview's current filtered view (same filters as the URL).
// kind=winners: every winner across colleges, for bulk prize payments.
// kind=contacts: every POC/contact across colleges, for shipping labels.
const KINDS = { colleges: "Colleges", winners: "Winners", contacts: "Contacts" } as const;
type Kind = keyof typeof KINDS;
export async function GET(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Not logged in", { status: 401 });
  if (!admin.isWriter) return new NextResponse("Viewers can't export", { status: 403 });

  const league = await getSelectedLeague();
  if (!league) return new NextResponse("No season selected", { status: 404 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = params.format === "csv" ? "csv" : "xlsx";
  const kind: Kind = params.kind === "winners" || params.kind === "contacts" ? params.kind : "colleges";
  const rows =
    kind === "winners"
      ? (await getSeasonWinners(league.id)).map(toWinnerRow)
      : kind === "contacts"
        ? (await getSeasonContacts(league.id)).map(toContactRow)
        : await collegeRows(league.id, params);

  // Header row even when empty, so the file still shows its columns.
  const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([EMPTY_HEADERS[kind]]);
  const slug = `${league.name}-${kind}-${new Date().toISOString().slice(0, 10)}`.replace(/[^\w.-]+/g, "-").toLowerCase();
  const headers = { "Cache-Control": "no-store" };

  if (format === "csv") {
    // BOM so Excel opens ₹ and Indian names correctly.
    const csv = "﻿" + XLSX.utils.sheet_to_csv(sheet);
    return new NextResponse(csv, {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.csv"` },
    });
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, KINDS[kind]);
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

const ist = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");

function toWinnerRow(w: Awaited<ReturnType<typeof getSeasonWinners>>[number]) {
  return {
    College: safe(w.college),
    Position: safe(w.position),
    Name: safe(w.name),
    Phone: safe(w.phone),
    Email: safe(w.email),
    UPI: safe(w.upi_id),
    "Prize (₹)": w.prize_amount,
    "Payment status": w.payment_status === "paid" ? "Paid" : "Pending",
    UTR: safe(w.payment_reference),
    "Paid at": ist(w.paid_at),
  };
}

function toContactRow(c: Awaited<ReturnType<typeof getSeasonContacts>>[number]) {
  return {
    College: safe(c.college),
    Name: safe(c.name),
    Role: c.is_primary ? "Primary POC" : c.role === "poc" ? "POC" : c.role === "captain" ? "Captain" : "Faculty",
    Phone: safe(c.phone),
    Email: safe(c.email),
    "T-shirt": c.tshirt_size ?? "",
    Address: safe(c.address),
    Pincode: safe(c.pincode),
    "Merch owed": safe(c.merch_description),
    "Merch sent": c.merch_sent ? "Yes" : "No",
    "Merch sent at": ist(c.merch_sent_at),
  };
}

const EMPTY_HEADERS: Record<Kind, string[]> = {
  colleges: ["College"],
  winners: ["College", "Position", "Name", "Phone", "Email", "UPI", "Prize (₹)", "Payment status", "UTR", "Paid at"],
  contacts: ["College", "Name", "Role", "Phone", "Email", "T-shirt", "Address", "Pincode", "Merch owed", "Merch sent", "Merch sent at"],
};

/** Same rows as the screen, including registrations found through a winner/contact search. */
async function collegeRows(leagueId: string, params: Record<string, string>) {
  const filters = parseOverviewFilters(params);
  const [rows, people] = await Promise.all([getOverview(leagueId), filters.q ? getSeasonPeople(leagueId) : []]);
  const ids = new Set(matchPeople(people, filters.q).map((p) => p.registrationId));
  return filterOverview(rows, filters, ids).map(toExportRow);
}
