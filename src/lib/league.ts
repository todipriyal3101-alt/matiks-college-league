// League operations constants and helpers shared by server and client (SPEC "League operations").

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
  rejected: "Rejected",
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

/** Effective prize pool = override if set, else the auto tier. */
export function effectivePrizePool(participantCount: number, override: number | null | undefined) {
  const auto = calcPrizePool(participantCount);
  const overridden = override != null;
  return { auto, amount: overridden ? override : auto, overridden };
}

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Whole rupees in Indian grouping: formatINR(100000) === "₹1,00,000". */
export function formatINR(amount: number | null | undefined): string {
  return `₹${inr.format(amount ?? 0)}`;
}
