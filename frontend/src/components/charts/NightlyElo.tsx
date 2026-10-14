import { useId, useState, type KeyboardEvent } from "react";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { dayFromKey, formatDayShort, formatWeekday } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import type { PlayerNightPoint } from "../../lib/insights";
import { EloChip } from "../ranking/Ranking";

const m = defineMessages({
  en: {
    none: "No rated matches yet.",
    record: "{w}W {d}D {l}L",
    night: "{date}: {elo} Elo",
    hint: "Tap a night",
  },
  tr: {
    none: "Henüz puanlı maç yok.",
    record: "{w}G {d}B {l}M",
    night: "{date}: {elo} Elo",
    hint: "Bir geceye dokun",
  },
});

/** The most recent nights the chart shows; older ones stay on the match-by-match chart. */
const MAX_NIGHTS = 30;

/** A player's rating after each night, with one night picked out: its rating, change and results. */
export function NightlyEloChart({ nights }: { nights: PlayerNightPoint[] }) {
  const t = useT(m);
  const id = useId().replace(/:/g, "");
  const shown = nights.slice(-MAX_NIGHTS);
  const [picked, setPicked] = useState<number | null>(null);
  if (!shown.length) return <p className="py-16 text-center text-sm text-muted">{t("none")}</p>;

  const sel = Math.min(picked ?? shown.length - 1, shown.length - 1);
  const night = shown[sel];
  // the rating going into the first night shown, then after each night
  const values = [shown[0].elo - shown[0].delta, ...shown.map((n) => n.elo)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(20, (max - min) * 0.15);
  const lo = min - pad;
  const hi = max + pad;
  const x = (i: number) => (i / (values.length - 1)) * 100;
  const y = (v: number) => ((hi - v) / (hi - lo)) * 100;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const step = 100 / (values.length - 1);
  const ticks = [0.25, 0.5, 0.75].map((f) => Math.round((hi - (hi - lo) * f) / 10) * 10);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPicked(Math.max(0, sel - 1));
    else if (e.key === "ArrowRight") setPicked(Math.min(shown.length - 1, sel + 1));
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="label">{formatWeekday(dayFromKey(night.key))}</p>
          <p className="mt-1 flex items-center gap-2">
            <span className="display tabular text-3xl">{night.elo}</span>
            <EloChip value={night.delta} />
          </p>
        </div>
        <p className="tabular text-sm text-muted">{t("record", { w: night.wins, d: night.draws, l: night.losses })}</p>
      </div>

      <div
        role="group"
        aria-label={t("hint")}
        tabIndex={0}
        onKeyDown={onKey}
        className="relative h-44 rounded-lg outline-offset-4 sm:h-56"
      >
        {ticks.map((v) => (
          <span key={v} className="tabular absolute right-0 -translate-y-1/2 text-[10px] text-faint" style={{ top: `${y(v)}%` }}>
            {v}
          </span>
        ))}
        {/* the plot leaves room on the right for the rating ticks */}
        <div className="absolute inset-y-0 left-0 right-10">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={`ne${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--chart-1)" stopOpacity="0.3" />
                <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((v) => (
              <line key={v} x1="0" x2="100" y1={y(v)} y2={y(v)} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={`${line} L100,100 L0,100 Z`} fill={`url(#ne${id})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1={x(sel + 1)}
              x2={x(sel + 1)}
              y1={y(night.elo)}
              y2="100"
              stroke="var(--chart-1)"
              strokeOpacity="0.5"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {shown.map((n, i) => (
            <span
              key={n.key}
              aria-hidden
              className={cn(
                "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all",
                i === sel
                  ? "size-3.5 bg-[var(--chart-1)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--chart-1)_25%,transparent),0_0_14px_var(--chart-1)]"
                  : "size-2.5 bg-surface ring-2 ring-[var(--chart-1)]",
              )}
              style={{ left: `${x(i + 1)}%`, top: `${y(n.elo)}%` }}
            />
          ))}
          {shown.map((n, i) => (
            <button
              key={n.key}
              type="button"
              tabIndex={-1}
              aria-pressed={i === sel}
              aria-label={t("night", { date: formatDayShort(dayFromKey(n.key)), elo: n.elo })}
              onClick={() => setPicked(i)}
              onPointerEnter={(e) => e.pointerType === "mouse" && setPicked(i)}
              className="absolute inset-y-0 cursor-pointer"
              style={{
                left: `${Math.max(0, x(i + 1) - step / 2)}%`,
                width: `${Math.min(100, x(i + 1) + step / 2) - Math.max(0, x(i + 1) - step / 2)}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="tabular mt-2 mr-10 flex justify-between text-[11px] text-faint">
        <span>{formatDayShort(dayFromKey(shown[0].key))}</span>
        <span>{formatDayShort(dayFromKey(shown[shown.length - 1].key))}</span>
      </div>
    </div>
  );
}
