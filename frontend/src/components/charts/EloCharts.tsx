import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../../lib/cn";
import { INITIAL_ELO, type EloPoint } from "../../lib/elo";
import { dayFromKey, displayName, formatDay, formatDayShort, matchdayKey } from "../../lib/format";

import { seriesColor } from "../../lib/chart";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";

/** Pad by ~30 and snap to multiples of 50 so ticks land on round numbers. */
const niceDomain: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor((min - 30) / 50) * 50,
  (max) => Math.ceil((max + 30) / 50) * 50,
];

const axisProps = {
  stroke: "var(--text-faint)",
  tick: { fill: "var(--text-faint)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function TooltipShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-xl border border-line-strong bg-surface/95 p-3 shadow-2xl backdrop-blur-md">
      <p className="label mb-2">{title}</p>
      {children}
    </div>
  );
}

const m = defineMessages({
  en: { match: "Match {i} · {date}", start: "Starting rating", peak: "Peak {elo}" },
  tr: { match: "{i}. maç · {date}", start: "Başlangıç puanı", peak: "Zirve {elo}" },
});

/* -------------------------------- Elo race --------------------------------- */

export interface RaceSeries {
  name: string;
  history: EloPoint[];
}

export function EloRaceChart({
  series,
  height = 320,
  className,
  colors,
}: {
  series: RaceSeries[];
  height?: number;
  className?: string;
  colors?: string[];
}) {
  const colorOf = (i: number) => colors?.[i] ?? seriesColor(i);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);

  const data = useMemo(() => {
    const days = new Set<string>();
    series.forEach((s) => s.history.forEach((h) => days.add(matchdayKey(h.time))));
    const ordered = [...days].sort();
    const rows = ordered.map((day) => ({ day }) as Record<string, number | string>);
    series.forEach((s) => {
      let i = 0;
      let current = INITIAL_ELO;
      ordered.forEach((day, d) => {
        while (i < s.history.length && matchdayKey(s.history[i].time) <= day) {
          current = s.history[i].elo;
          i++;
        }
        rows[d][s.name] = Math.round(current);
      });
    });
    return rows;
  }, [series]);

  const visible = series.filter((s) => !hidden.has(s.name));

  return (
    <div className={className}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
            <XAxis
              dataKey="day"
              {...axisProps}
              tickFormatter={(d: string) => formatDayShort(dayFromKey(d))}
              minTickGap={28}
            />
            <YAxis {...axisProps} domain={niceDomain} width={52} allowDecimals={false} tickCount={6} />
            <ReferenceLine y={INITIAL_ELO} stroke="var(--border-strong)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: "var(--border-strong)" }}
              content={(p) => {
                if (!p.active || !p.payload?.length) return null;
                const rows = [...p.payload].sort((a, b) => Number(b.value) - Number(a.value));
                return (
                  <TooltipShell title={formatDay(dayFromKey(String(p.label)))}>
                    <div className="space-y-1.5">
                      {rows.map((r) => (
                        <div key={String(r.dataKey)} className="flex items-center gap-2 text-sm">
                          <span className="size-2 rounded-full" style={{ background: r.color }} />
                          <span className="flex-1">{displayName(String(r.dataKey))}</span>
                          <span className="tabular font-semibold">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </TooltipShell>
                );
              }}
            />
            {visible.map((s) => {
              const i = series.indexOf(s);
              const dim = focus && focus !== s.name;
              return (
                <Line
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={colorOf(i)}
                  strokeWidth={focus === s.name ? 3.5 : 2.25}
                  strokeOpacity={dim ? 0.15 : 1}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={900}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {series.map((s, i) => {
          const off = hidden.has(s.name);
          return (
            <button
              key={s.name}
              onMouseEnter={() => setFocus(s.name)}
              onMouseLeave={() => setFocus(null)}
              onClick={() =>
                setHidden((h) => {
                  const n = new Set(h);
                  if (n.has(s.name)) n.delete(s.name);
                  else n.add(s.name);
                  return n;
                })
              }
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                off ? "border-line text-faint opacity-60" : "border-line-strong bg-surface-2 text-fg",
              )}
            >
              <span className="size-2 rounded-full" style={{ background: off ? "var(--text-faint)" : colorOf(i) }} />
              {displayName(s.name)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Player Elo area ----------------------------- */

export function PlayerEloChart({ history, height = 260 }: { history: EloPoint[]; height?: number }) {
  const t = useT(m);
  const data = useMemo(
    () => [
      { i: 0, elo: INITIAL_ELO, time: null as Date | null },
      ...history.map((h, i) => ({ i: i + 1, elo: Math.round(h.elo), time: h.time })),
    ],
    [history],
  );
  const peak = data.reduce((a, b) => (b.elo > a.elo ? b : a), data[0]);
  const up = data[data.length - 1].elo >= INITIAL_ELO;
  const color = up ? "var(--accent)" : "var(--loss)";
  const stroke = up ? "var(--chart-1)" : "var(--loss)";

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity={0.35} />
              <stop offset="1" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 6" vertical={false} />
          <XAxis dataKey="i" {...axisProps} tickFormatter={(v: number) => (v ? `#${v}` : "")} minTickGap={24} />
          <YAxis {...axisProps} domain={niceDomain} width={52} allowDecimals={false} tickCount={6} />
          <ReferenceLine y={INITIAL_ELO} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)" }}
            content={(p) => {
              if (!p.active || !p.payload?.length) return null;
              const row = p.payload[0].payload as { i: number; elo: number; time: Date | null };
              return (
                <TooltipShell title={row.time ? t("match", { i: row.i, date: formatDay(row.time) }) : t("start")}>
                  <p className="display text-2xl">{row.elo}</p>
                </TooltipShell>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="elo"
            stroke={stroke}
            strokeWidth={2.5}
            fill="url(#eloFill)"
            animationDuration={900}
            activeDot={{ r: 5, strokeWidth: 0, fill: stroke }}
          />
          {peak.i > 0 && (
            <ReferenceDot
              x={peak.i}
              y={peak.elo}
              r={5}
              fill="var(--gold)"
              stroke="var(--surface)"
              strokeWidth={2}
              label={{ value: t("peak", { elo: peak.elo }), position: peak.i > data.length * 0.75 ? "left" : "top", offset: 10, fill: "var(--gold)", fontSize: 11, fontWeight: 600 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
