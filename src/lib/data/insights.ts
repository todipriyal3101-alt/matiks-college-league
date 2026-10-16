import "server-only";

import { createClient } from "@/lib/supabase/server";

export type Insights = {
  perDay: { date: string; label: string; count: number }[];
  bySource: { name: string; count: number }[];
  byState: { name: string; count: number }[];
  topReferrals: { code: string; ambassador: string | null; count: number }[];
  total: number;
};

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const STATE_LIMIT = 10;

/**
 * Insights for one season, computed in the app from rows admins can already read (RLS).
 * Volumes are hundreds of registrations, so this is cheaper than maintaining SQL functions.
 */
export async function getInsights(leagueId: string): Promise<Insights> {
  const supabase = await createClient();
  const [regs, ambassadors] = await Promise.all([
    supabase.from("registrations").select("created_at, utm_source, referral_code, colleges(state)").eq("league_id", leagueId),
    supabase.from("ambassadors").select("name, referral_code"),
  ]);
  if (regs.error) throw new Error(`getInsights: ${regs.error.message}`);
  const rows = regs.data;

  // Per day (IST), including zero days between the first and last registration.
  const perDayMap = new Map<string, number>();
  for (const r of rows) {
    const k = dayKey.format(new Date(r.created_at));
    perDayMap.set(k, (perDayMap.get(k) ?? 0) + 1);
  }
  const keys = [...perDayMap.keys()].sort();
  const perDay: Insights["perDay"] = [];
  if (keys.length) {
    for (let d = new Date(`${keys[0]}T12:00:00+05:30`); dayKey.format(d) <= keys.at(-1)!; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = dayKey.format(d);
      perDay.push({ date: k, label: dayLabel.format(d), count: perDayMap.get(k) ?? 0 });
    }
  }

  const tally = (values: string[]) => {
    const m = new Map<string, number>();
    for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };

  const bySource = tally(rows.map((r) => r.utm_source ?? "direct"));
  const states = tally(rows.map((r) => r.colleges.state ?? "Unknown"));
  const byState =
    states.length > STATE_LIMIT
      ? [...states.slice(0, STATE_LIMIT), { name: "Other", count: states.slice(STATE_LIMIT).reduce((s, x) => s + x.count, 0) }]
      : states;

  const names = new Map((ambassadors.data ?? []).map((a) => [a.referral_code.toUpperCase(), a.name]));
  const topReferrals = tally(rows.flatMap((r) => (r.referral_code ? [r.referral_code.toUpperCase()] : [])))
    .slice(0, 10)
    .map(({ name, count }) => ({ code: name, ambassador: names.get(name) ?? null, count }));

  return { perDay, bySource, byState, topReferrals, total: rows.length };
}
