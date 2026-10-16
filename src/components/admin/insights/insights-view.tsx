import { BarChart3Icon, MegaphoneIcon } from "lucide-react";

import { EmptyState } from "@/components/league/empty-state";
import { Card } from "@/components/ui/card";
import { getInsights } from "@/lib/data/insights";

import { InsightsCharts } from "./insights-charts";

export async function InsightsView({ leagueId }: { leagueId: string }) {
  const insights = await getInsights(leagueId);
  if (insights.total === 0) {
    return <EmptyState icon={BarChart3Icon} title="No registrations yet" description="Charts appear as soon as colleges start registering." />;
  }
  return (
    <div className="space-y-4">
      <InsightsCharts insights={insights} />
      <Card className="gap-3 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Top referral codes</h2>
          <p className="text-sm text-muted-foreground">Registrations credited to each ambassador link this season.</p>
        </div>
        {insights.topReferrals.length === 0 ? (
          <EmptyState icon={MegaphoneIcon} title="No referrals yet" description="Give ambassadors their /register?ref=CODE links from the Ambassadors page." />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1.5 pr-4 text-left font-medium">Code</th>
                <th className="py-1.5 text-left font-medium">Ambassador</th>
                <th className="py-1.5 text-right font-medium">Registrations</th>
              </tr>
            </thead>
            <tbody>
              {insights.topReferrals.map((r) => (
                <tr key={r.code} className="border-t border-border/60">
                  <td className="py-1.5 pr-4 font-mono">{r.code}</td>
                  <td className="py-1.5">{r.ambassador ?? <span className="text-muted-foreground italic">no ambassador with this code</span>}</td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
