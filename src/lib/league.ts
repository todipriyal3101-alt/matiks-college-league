// League operations constants and helpers shared by server and client (SPEC "League operations").

import type { Country } from "@/lib/validation/portal";

/** The product name. Event names come only from the database (leagues.name), never from code. */
export const BRAND = "Matiks College League";

/** Where POCs write when the portal can't help (e.g. registrations paused and no college yet). */
export const SUPPORT_EMAIL = "satish@matiks.com";

const BRAND_PREFIX = /^\s*matiks college league\s*[-–—·:|,]?\s*/i;

/** The season's own part of its name: "Matiks College League – Season 1" → "Season 1"; others unchanged. */
export function seasonShortName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.replace(BRAND_PREFIX, "") || "";
}

/** "Matiks College League · Season 1" for titles, emails and share text (never repeats the brand). */
export function brandedSeason(name: string | null | undefined): string {
  const short = seasonShortName(name);
  return short ? `${BRAND} · ${short}` : BRAND;
}

/** Stage of a registration within its season. Values match the registration_stage enum (migration 0003). */
export const STAGES = ["registration_phase", "live", "ended_prize_pending", "ended_prize_sent"] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  registration_phase: "Registration",
  live: "Live",
  ended_prize_pending: "Prize pending",
  ended_prize_sent: "Complete",
};

/** Admin review of a registration (registrations.status). */
export const REVIEW_STATUSES = ["pending", "approved", "waitlisted", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  waitlisted: "Waitlisted",
  rejected: "Denied",
};

/** Auto prize pool by participant count. Must match calc_prize_pool() in migration 0003. */
export const PRIZE_TIERS = [
  { min: 600, amount: 10000 },
  { min: 400, amount: 7500 },
  { min: 200, amount: 5000 },
  { min: 0, amount: 3000 },
] as const;

export function calcPrizePool(participantCount: number): number {
  const count = Math.max(0, Math.floor(participantCount) || 0);
  return PRIZE_TIERS.find((t) => count >= t.min)!.amount;
}

/**
 * Effective prize pool = override if set, else the auto tier. USA has no auto tier (migration 0005): its pool is
 * whatever an admin sets, else 0. Must match registration_overview.prize_pool.
 */
export function effectivePrizePool(participantCount: number, override: number | null | undefined, country: Country = "india") {
  const auto = country === "usa" ? null : calcPrizePool(participantCount);
  const overridden = override != null;
  return { auto, amount: overridden ? override : (auto ?? 0), overridden };
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Whole rupees in Indian grouping: formatINR(100000) === "₹1,00,000". */
export function formatINR(amount: number | null | undefined): string {
  return `₹${inr.format(amount ?? 0)}`;
}

const usd = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Prize money in the college's currency: ₹ (Indian grouping) for India, $ for the USA. Never mix the two in one total. */
export function formatMoney(amount: number | null | undefined, country: Country = "india"): string {
  return country === "usa" ? `$${usd.format(amount ?? 0)}` : formatINR(amount);
}

/** Today's date (YYYY-MM-DD) in the college's country: IST for India, New York for the USA. */
export function todayIn(country: Country = "india", now = new Date()): string {
  const timeZone = country === "usa" ? "America/New_York" : "Asia/Kolkata";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * The automatic stage from the dates and payouts. Must match derive_stage() in migration 0005:
 * before league start = Registration; start..end = Live; after the end = Prize pending until every winner is paid
 * (and there is at least one), then Complete. No league start → the stored stage. The admin override wins elsewhere.
 */
export function deriveStage(r: {
  stored: Stage;
  country: Country;
  leagueStart: string | null;
  leagueEnd: string | null;
  winnersTotal: number;
  winnersPaid: number;
}): Stage {
  if (!r.leagueStart) return r.stored;
  const today = todayIn(r.country);
  if (today < r.leagueStart) return "registration_phase";
  if (!r.leagueEnd || today <= r.leagueEnd) return "live";
  return r.winnersTotal > 0 && r.winnersPaid >= r.winnersTotal ? "ended_prize_sent" : "ended_prize_pending";
}
