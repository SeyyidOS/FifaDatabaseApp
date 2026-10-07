import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { Appearance, HourStat } from "../../lib/analysis";
import { SOURCE_SERIES, type EloSourceRow } from "./eloSources";
import { displayName, formatDay } from "../../lib/format";
import type { Outcome } from "../../lib/types";

const axis = {
  stroke: "var(--text-faint)",
  tick: { fill: "var(--text-faint)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function Tip({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-48 rounded-xl border border-line-strong bg-surface/95 p-3 text-sm shadow-2xl backdrop-blur-md">
      <p className="label mb-2">{title}</p>
      {children}
    </div>
  );
}

const signedElo = (v: number) => (Math.round(v) === 0 ? "0" : `${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))}`);

/* --------------------------- Where the Elo comes from --------------------------- */

export function EloSourcesChart({ rows }: { rows: EloSourceRow[] }) {
  return (
    <div style={{ height: Math.max(220, rows.length * 38 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" horizontal={false} />
          <XAxis type="number" {...axis} tickFormatter={signedElo} />
          <YAxis type="category" dataKey="name" {...axis} width={78} tickFormatter={(n: string) => displayName(n)} />
          <ReferenceLine x={0} stroke="var(--border-strong)" />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(p) => {
              if (!p.active || !p.payload?.length) return null;
              const row = p.payload[0].payload as EloSourceRow;
              const net = SOURCE_SERIES.reduce((s, x) => s + row[x.key], 0);
              return (
                <Tip title={`${displayName(row.name)} · net ${signedElo(net)} Elo`}>
                  <div className="space-y-1">
                    {SOURCE_SERIES.filter((x) => Math.round(row[x.key]) !== 0).map((x) => (
                      <div key={x.key} className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: x.color }} />
                        <span className="flex-1 text-muted">{x.label}</span>
                        <span className="tabular font-semibold">{signedElo(row[x.key])}</span>
                      </div>
                    ))}
                  </div>
                </Tip>
              );
            }}
          />
          {SOURCE_SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="elo" fill={s.color} radius={0} animationDuration={800} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------- Beating the odds ------------------------------- */

export interface OddsRow {
  name: string;
  over: number;
  expected: number;
  actual: number;
  played: number;
}

export function OddsChart({ rows }: { rows: OddsRow[] }) {
  return (
    <div style={{ height: Math.max(200, rows.length * 34 + 40) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }} barCategoryGap={10}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" horizontal={false} />
          <XAxis type="number" {...axis} tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)} />
          <YAxis type="category" dataKey="name" {...axis} width={78} tickFormatter={(n: string) => displayName(n)} />
          <ReferenceLine x={0} stroke="var(--border-strong)" />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(p) => {
              if (!p.active || !p.payload?.length) return null;
              const r = p.payload[0].payload as OddsRow;
              return (
                <Tip title={displayName(r.name)}>
                  <p>
                    <span className="tabular font-semibold">{r.actual.toFixed(1)}</span>
                    <span className="text-muted"> points from </span>
                    <span className="tabular font-semibold">{r.expected.toFixed(1)}</span>
                    <span className="text-muted"> expected in {r.played} matches</span>
                  </p>
                  <p className={r.over >= 0 ? "mt-1 font-semibold text-win" : "mt-1 font-semibold text-loss"}>
                    {r.over >= 0 ? "+" : "−"}
                    {Math.abs(r.over).toFixed(1)} vs the odds
                  </p>
                </Tip>
              );
            }}
          />
          <Bar dataKey="over" radius={[0, 6, 6, 0]} animationDuration={800}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.over >= 0 ? "var(--win)" : "var(--loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ---------------------------------- Match map ---------------------------------- */

const OUTCOME_COLOR: Record<Outcome, string> = { W: "var(--win)", D: "var(--draw)", L: "var(--loss)" };
const OUTCOME_LABEL: Record<Outcome, string> = { W: "Win", D: "Draw", L: "Loss" };

export function MatchMapChart({ apps, height = 280 }: { apps: Appearance[]; height?: number }) {
  const series = (["W", "D", "L"] as Outcome[]).map((o) => ({
    o,
    points: apps
      .filter((a) => a.outcome === o)
      .map((a) => ({ x: Math.round(a.expected * 1000) / 10, y: Math.round(a.delta * 10) / 10, a })),
  }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            {...axis}
            tickFormatter={(v: number) => `${v}%`}
          />
          <YAxis type="number" dataKey="y" {...axis} width={52} tickFormatter={signedElo} />
          <ZAxis range={[46, 46]} />
          <ReferenceLine y={0} stroke="var(--border-strong)" />
          <ReferenceLine x={50} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3", stroke: "var(--border-strong)" }}
            content={(p) => {
              if (!p.active || !p.payload?.length) return null;
              const { a } = p.payload[0].payload as { a: Appearance };
              return (
                <Tip title={`${formatDay(a.match.date)} · ${OUTCOME_LABEL[a.outcome]} ${a.gf}–${a.ga}`}>
                  <p className="text-muted">
                    {a.partners.length ? `with ${a.partners.map(displayName).join(" & ")} ` : ""}
                    vs {a.opponents.map(displayName).join(" & ")}
                  </p>
                  <p className="mt-1 text-muted">
                    {a.club} v {a.oppClub}
                  </p>
                  <p className="mt-2">
                    <span className="tabular font-semibold">{Math.round(a.expected * 100)}%</span>
                    <span className="text-muted"> to win · </span>
                    <span className={a.delta >= 0 ? "font-semibold text-win" : "font-semibold text-loss"}>
                      {signedElo(a.delta)} Elo
                    </span>
                  </p>
                </Tip>
              );
            }}
          />
          {series.map((s) => (
            <Scatter key={s.o} data={s.points} fill={OUTCOME_COLOR[s.o]} fillOpacity={0.8} animationDuration={700} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------- Goals by the hour ------------------------------ */

/** Hours with fewer matches than this are drawn but never called the peak. */
export const PEAK_MIN_MATCHES = 5;

export function GoalsByHourChart({ hours }: { hours: HourStat[] }) {
  const data = hours.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}:00`, avg: h.goals / h.matches }));
  const peak = Math.max(...data.filter((d) => d.matches >= PEAK_MIN_MATCHES).map((d) => d.avg));
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={8} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={(p) => {
              if (!p.active || !p.payload?.length) return null;
              const d = p.payload[0].payload as (typeof data)[number];
              return (
                <Tip title={`Kick-off ${d.label}`}>
                  <p>
                    <span className="tabular font-semibold">{d.avg.toFixed(1)}</span>
                    <span className="text-muted"> goals per match · {d.matches} matches</span>
                  </p>
                </Tip>
              );
            }}
          />
          <Bar dataKey="avg" radius={[6, 6, 0, 0]} animationDuration={800}>
            {data.map((d) => (
              <Cell key={d.hour} fill={d.avg === peak ? "var(--accent)" : "var(--chart-2)"} fillOpacity={d.avg === peak ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
