import type { OverviewRow } from "@/lib/data/league-ops";
import { formatDay } from "@/lib/ist";
import { STAGE_LABELS, type Stage } from "@/lib/league";

/** "Starts 15 Nov 2026" / "Live · ends 30 Nov 2026" / "Prize pending · 1/3 paid" / "Complete", from the derived stage. */
export function stageLine(r: Pick<OverviewRow, "effective_stage" | "league_start" | "league_end" | "winners_paid" | "winners_total">): string {
  const stage = (r.effective_stage ?? "registration_phase") as Stage;
  switch (stage) {
    case "registration_phase":
      return r.league_start ? `Starts ${formatDay(r.league_start)}` : STAGE_LABELS[stage];
    case "live":
      return r.league_end ? `Live · ends ${formatDay(r.league_end)}` : STAGE_LABELS[stage];
    case "ended_prize_pending":
      return r.winners_total ? `Prize pending · ${r.winners_paid}/${r.winners_total} paid` : "Prize pending · no winners yet";
    default:
      return STAGE_LABELS[stage];
  }
}
