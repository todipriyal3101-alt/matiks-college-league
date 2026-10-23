import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { getAdmin } from "@/lib/auth/admin";
import type { OverviewRow } from "@/lib/data/league-ops";
import { getContacts, getParticipants, getWinners } from "@/lib/data/people";
import { getAdminCountry, getRegistrations } from "@/lib/data/portal";
import { REVIEW_LABELS, STAGE_LABELS } from "@/lib/league";
import { COUNTRY_LABELS, type Country } from "@/lib/validation/portal";

// "Export all data": one Excel file for the selected country (India / USA switch), all seasons, with four sheets:
// Colleges, POCs, Winners, Participants. Admin writers only: viewers can read but never export (CLAUDE.md rule 4).
export async function GET() {
  const admin = await getAdmin();
  if (!admin) return new NextResponse("Not logged in", { status: 401 });
  if (!admin.isWriter) return new NextResponse("Viewers can't export", { status: 403 });

  const country = await getAdminCountry();
  const [colleges, contacts, winners, participants] = await Promise.all([
    getRegistrations(country),
    getContacts(country),
    getWinners(country),
    getParticipants(country),
  ]);
  const money = country === "usa" ? "($)" : "(₹)";

  const book = XLSX.utils.book_new();
  addSheet(book, "Colleges", colleges.map((r) => collegeRow(r, money)), [`College`]);
  addSheet(book, "POCs", contacts.map(contactRow), ["College", "Name"]);
  addSheet(book, "Winners", winners.map((w) => winnerRow(w, money)), ["College", "Position"]);
  addSheet(book, "Participants", participants.map(participantRow), ["College", "Name"]);

  const slug = `matiks-college-league-${COUNTRY_LABELS[country]}-${new Date().toISOString().slice(0, 10)}`.toLowerCase();
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}.xlsx"`,
    },
  });
}

/** A header row even when empty, so the sheet still shows its columns. */
function addSheet(book: XLSX.WorkBook, name: string, rows: Record<string, unknown>[], emptyHeaders: string[]) {
  const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([emptyHeaders]);
  XLSX.utils.book_append_sheet(book, sheet, name);
}

/** Text a spreadsheet would treat as a formula gets a leading apostrophe (CSV/formula injection). */
function safe(value: string | null | undefined) {
  if (!value) return "";
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const ist = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");

function collegeRow(r: OverviewRow, money: string) {
  return {
    College: safe(r.college_name),
    Country: COUNTRY_LABELS[(r.country ?? "india") as Country],
    Season: safe(r.league_name),
    City: safe(r.city),
    State: safe(r.state),
    "Review status": r.review_status ? REVIEW_LABELS[r.review_status] : "",
    "Deny reason": safe(r.deny_reason),
    Stage: r.effective_stage ? STAGE_LABELS[r.effective_stage] : "",
    "Stage overridden": r.stage_override ? "Yes" : "No",
    "Registration start": r.registration_start ?? "",
    "League start": r.league_start ?? "",
    "League end": r.league_end ?? "",
    "College email": safe(r.college_email),
    "Email domain": safe(r.email_domain),
    "POC login email": safe(r.poc_email),
    "Domain mismatch": r.domain_mismatch ? "Yes" : "",
    "Hosted by (club)": safe(r.club_name),
    "College logo URL": safe(r.college_logo_url),
    "Club logo URL": safe(r.club_logo_url),
    Team: safe(r.team_name),
    Participants: r.participant_count ?? 0,
    [`Auto tier ${money}`]: r.auto_prize_pool ?? "",
    [`Override ${money}`]: r.prize_pool_override ?? "",
    [`Prize pool ${money}`]: r.prize_pool ?? 0,
    "Primary POC": safe(r.primary_poc_name),
    "Winners paid": r.winners_paid ?? 0,
    "Winners total": r.winners_total ?? 0,
    [`Prize paid ${money}`]: r.prize_paid_amount ?? 0,
    Source: safe(r.utm_source ?? "direct"),
    "Referral code": safe(r.referral_code),
    "Registered at": ist(r.created_at),
  };
}

function contactRow(c: Awaited<ReturnType<typeof getContacts>>[number]) {
  return {
    College: safe(c.college),
    Season: safe(c.league),
    Name: safe(c.name),
    Role: c.is_primary ? "Primary POC" : c.role === "poc" ? "POC" : c.role === "captain" ? "Captain" : "Faculty",
    Phone: safe(c.phone),
    Email: safe(c.email),
    Year: safe(c.year),
    Course: safe(c.course),
    "Matiks username": safe(c.matiks_username),
    "T-shirt": c.tshirt_size ?? "",
    Address: safe(c.address),
    Pincode: safe(c.pincode),
    "Merch owed": safe(c.merch_description),
    "Merch sent": c.merch_sent ? "Yes" : "No",
    "Merch sent at": ist(c.merch_sent_at),
  };
}

function winnerRow(w: Awaited<ReturnType<typeof getWinners>>[number], money: string) {
  return {
    College: safe(w.college),
    Season: safe(w.league),
    Position: safe(w.position),
    Name: safe(w.name),
    Phone: safe(w.phone),
    Email: safe(w.email),
    UPI: safe(w.upi_id),
    [`Prize ${money}`]: w.prize_amount,
    "Payment status": w.payment_status === "paid" ? "Paid" : "Pending",
    UTR: safe(w.payment_reference),
    "Paid at": ist(w.paid_at),
    "Merch sent": w.merch_sent ? "Yes" : "No",
  };
}

function participantRow(p: Awaited<ReturnType<typeof getParticipants>>[number]) {
  return {
    College: safe(p.college),
    Season: safe(p.league),
    Name: safe(p.name),
    Email: safe(p.email),
    "Matiks username": safe(p.matiks_username),
    Year: safe(p.year),
  };
}
