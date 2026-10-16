"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card } from "@/components/ui/card";
import type { Insights } from "@/lib/data/insights";

// Single-series charts (dataviz skill): one hue (primary, validated on the dark card), no legend box,
// 2px line + ~10% area wash, bars <= 24px with 4px rounded ends, hairline solid grid, text in text tokens.
const SERIES = "var(--primary)";
const GRID = "var(--border)";
const AXIS_TEXT = { fill: "var(--muted-foreground)", fontSize: 12 };

function ChartCard({ title, subtitle, children, table }: { title: string; subtitle: string; children: React.ReactNode; table: React.ReactNode }) {
  return (
    <Card className="gap-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show data</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">{table}</div>
      </details>
    </Card>
  );
}

function DataTable({ head, rows }: { head: [string, string]; rows: [string, number][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-muted-foreground">
        <tr>
          <th className="py-1 text-left font-medium">{head[0]}</th>
          <th className="py-1 text-right font-medium">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-t border-border/60">
            <td className="py-1">{k}</td>
            <td className="py-1 text-right font-mono tabular-nums">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-mono text-sm text-foreground">
        {payload[0].value} registration{payload[0].value === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function HorizontalBars({ data }: { data: { name: string; count: number }[] }) {
  return (
    <div style={{ height: Math.max(120, data.length * 36) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TEXT} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={120} tick={AXIS_TEXT} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.3 }} content={<ChartTooltip />} />
          <Bar dataKey="count" fill={SERIES} maxBarSize={24} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" style={{ fill: "var(--foreground)", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InsightsCharts({ insights }: { insights: Insights }) {
  const peak = insights.perDay.reduce((m, d) => Math.max(m, d.count), 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <ChartCard
          title="Registrations per day"
          subtitle={`${insights.total} in total · busiest day ${peak} (IST days)`}
          table={<DataTable head={["Day", "Registrations"]} rows={insights.perDay.map((d) => [d.label, d.count])} />}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={insights.perDay} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
                <XAxis dataKey="label" tick={AXIS_TEXT} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tick={AXIS_TEXT} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={SERIES}
                  strokeWidth={2}
                  fill={SERIES}
                  fillOpacity={0.1}
                  // Few days: show each day's point (filled, surface ring); many days: line only.
                  dot={insights.perDay.length <= 14 ? { r: 4, fill: SERIES, stroke: "var(--card)", strokeWidth: 2 } : false}
                  activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2, fill: SERIES }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
      <ChartCard
        title="By source"
        subtitle="utm_source of the first visit; direct = no link tag"
        table={<DataTable head={["Source", "Registrations"]} rows={insights.bySource.map((d) => [d.name, d.count])} />}
      >
        <HorizontalBars data={insights.bySource} />
      </ChartCard>
      <ChartCard
        title="By state"
        subtitle="College location; top 10, the rest grouped as Other"
        table={<DataTable head={["State", "Registrations"]} rows={insights.byState.map((d) => [d.name, d.count])} />}
      >
        <HorizontalBars data={insights.byState} />
      </ChartCard>
    </div>
  );
}
