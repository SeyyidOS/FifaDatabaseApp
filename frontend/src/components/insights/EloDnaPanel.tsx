import type { ReactNode } from "react";
import { Dna, MoonStar, RotateCcw, Scale, Shield, TrendingDown, TrendingUp } from "lucide-react";
import { scoreRate, type Appearance, type Bucket, type ClubEdge, type EloDna, type Role } from "../../lib/analysis";
import { cn } from "../../lib/cn";
import { displayName, formatDay } from "../../lib/format";
import { Delta, Panel } from "../ui/primitives";
import { RecordStrip } from "./RecordStrip";

const ROLES: { key: Role; label: string; hint: string }[] = [
  { key: "favourite", label: "As favourite", hint: "55%+ to win" },
  { key: "even", label: "Coin flips", hint: "45–55%" },
  { key: "underdog", label: "As underdog", hint: "45% or less" },
];

const CLUBS: { key: ClubEdge; label: string }[] = [
  { key: "stronger", label: "Stronger club" },
  { key: "level", label: "Level clubs" },
  { key: "weaker", label: "Weaker club" },
];

function Situation({ label, hint, bucket, total }: { label: string; hint?: string; bucket: Bucket; total: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{label}</p>
        <Delta value={bucket.delta} className="text-sm" />
      </div>
      <p className="mt-0.5 text-[11px] text-faint">
        {hint ? `${hint} · ` : ""}
        {bucket.played} games{total ? ` (${Math.round((bucket.played / total) * 100)}%)` : ""}
      </p>
      {bucket.played > 0 && <RecordStrip record={bucket} className="mt-3" />}
    </div>
  );
}

function Fact({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: ReactNode; detail: ReactNode; tone?: string }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-text ring-1 ring-line">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted">{label}</p>
        <p className={cn("display text-2xl", tone)}>{value}</p>
        <p className="text-[11px] text-faint">{detail}</p>
      </div>
    </div>
  );
}

const vs = (a: Appearance) =>
  `${a.gf}–${a.ga} vs ${a.opponents.map(displayName).join(" & ")} · ${Math.round(a.expected * 100)}% to win · ${formatDay(a.match.date)}`;

export function EloDnaPanel({ dna, name, className }: { dna: EloDna; name: string; className?: string }) {
  const total = dna.all.played;
  const pts = (b: Bucket) => `${Math.round(scoreRate(b))}%`;
  return (
    <Panel title="Elo DNA" subtitle={`How ${displayName(name)} earns (and loses) rating`} icon={<Dna className="size-4" />} className={className}>
      <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
        <p className="label text-accent-text">Archetype</p>
        <p className="display mt-1.5 text-4xl">{dna.archetype.title}</p>
        <p className="mt-1 text-sm text-muted">{dna.archetype.blurb}</p>
      </div>

      <p className="label mt-6 mb-3">By the odds before kick-off</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {ROLES.map((r) => (
          <Situation key={r.key} label={r.label} hint={r.hint} bucket={dna.byRole[r.key]} total={total} />
        ))}
      </div>

      <p className="label mt-6 mb-3">By club strength</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CLUBS.map((c) => (
          <Situation key={c.key} label={c.label} bucket={dna.byClub[c.key]} total={total} />
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Fact
          icon={<Scale className="size-4" />}
          label="Against the odds"
          value={`${dna.overPerformance >= 0 ? "+" : "−"}${Math.abs(dna.overPerformance).toFixed(1)}`}
          tone={dna.overPerformance >= 0 ? "text-win" : "text-loss"}
          detail={`${dna.all.score.toFixed(1)} points taken, ${dna.all.expected.toFixed(1)} expected`}
        />
        <Fact
          icon={<RotateCcw className="size-4" />}
          label="Right after a loss"
          value={dna.afterLoss.played ? pts(dna.afterLoss) : "—"}
          detail={`of points (${dna.afterLoss.played} games) · ${pts(dna.afterWin)} after a win`}
        />
        <Fact
          icon={<MoonStar className="size-4" />}
          label="After midnight"
          value={dna.afterMidnight.played ? pts(dna.afterMidnight) : "—"}
          detail={`of points (${dna.afterMidnight.played} games) · ${pts(dna.beforeMidnight)} before`}
        />
        <Fact
          icon={<Shield className="size-4" />}
          label="Club edge on average"
          value={`${dna.avgClubDiff >= 0 ? "+" : "−"}${Math.abs(Math.round(dna.avgClubDiff))}`}
          detail="club Elo over the opponent's"
        />
        {dna.best && dna.best.delta > 0 && (
          <Fact
            icon={<TrendingUp className="size-4" />}
            label="Biggest gain"
            value={`+${Math.round(dna.best.delta)}`}
            tone="text-win"
            detail={vs(dna.best)}
          />
        )}
        {dna.worst && dna.worst.delta < 0 && (
          <Fact
            icon={<TrendingDown className="size-4" />}
            label="Biggest drop"
            value={`−${Math.abs(Math.round(dna.worst.delta))}`}
            tone="text-loss"
            detail={vs(dna.worst)}
          />
        )}
      </div>
    </Panel>
  );
}
