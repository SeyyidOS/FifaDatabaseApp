import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "motion/react";
import type { MouseEvent } from "react";
import type { RankedPlayer } from "../hooks/analytics-context";
import { cn } from "../lib/cn";
import { displayName } from "../lib/format";
import { eloToOvr } from "../lib/insights";
import { initials, playerGradient } from "../lib/identity";
import { ClubCrest } from "./ui/Identity";

type Tier = "special" | "gold" | "silver" | "bronze";

const TIERS: Record<Tier, { bg: string; ink: string; sub: string; line: string; label: string }> = {
  special: {
    bg: "radial-gradient(120% 80% at 50% 0%, #2c3a07 0%, #10150a 55%, #07090a 100%)",
    ink: "#d8ff5a",
    sub: "rgba(216,255,90,.65)",
    line: "rgba(216,255,90,.35)",
    label: "Leader",
  },
  gold: {
    bg: "linear-gradient(160deg, #fbe9a4 0%, #e4bb4f 38%, #b98622 75%, #9d6f16 100%)",
    ink: "#3a2905",
    sub: "rgba(58,41,5,.7)",
    line: "rgba(58,41,5,.25)",
    label: "Gold",
  },
  silver: {
    bg: "linear-gradient(160deg, #f4f7fa 0%, #c9d1da 40%, #9aa6b3 80%, #85919f 100%)",
    ink: "#1d2633",
    sub: "rgba(29,38,51,.7)",
    line: "rgba(29,38,51,.2)",
    label: "Silver",
  },
  bronze: {
    bg: "linear-gradient(160deg, #f2c49b 0%, #c98756 40%, #9c5d34 80%, #844b28 100%)",
    ink: "#2c1405",
    sub: "rgba(44,20,5,.7)",
    line: "rgba(44,20,5,.22)",
    label: "Bronze",
  },
};

function tierFor(p: RankedPlayer): Tier {
  if (p.rank === 1 && !p.provisional) return "special";
  const ovr = eloToOvr(p.elo);
  return ovr >= 75 ? "gold" : ovr >= 65 ? "silver" : "bronze";
}

function attributes(p: RankedPlayer) {
  const s = p.stats;
  const played = s?.played ?? 0;
  const per = (n: number) => (played ? n / played : 0);
  const formPts = (s?.outcomes.slice(0, 5) ?? []).reduce((a, o) => a + (o === "W" ? 3 : o === "D" ? 1 : 0), 0);
  const formMax = Math.max(1, Math.min(5, s?.outcomes.length ?? 0) * 3);
  const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
  return [
    { k: "WIN", v: clamp(per(s?.wins ?? 0) * 100), t: "Win rate" },
    { k: "ATT", v: clamp(per(s?.gf ?? 0) * 20), t: "Goals scored per match × 20" },
    { k: "DEF", v: clamp(99 - per(s?.ga ?? 0) * 20), t: "99 − goals conceded per match × 20" },
    { k: "FRM", v: clamp((formPts / formMax) * 99), t: "Points from the last 5 matches" },
    { k: "CON", v: clamp(per((s?.wins ?? 0) + (s?.draws ?? 0)) * 100), t: "Unbeaten rate" },
    { k: "EXP", v: clamp(played), t: "Matches played" },
  ];
}

function favouriteClub(p: RankedPlayer): string | null {
  let best: [string, number] | null = null;
  p.stats?.clubs.forEach((r, name) => {
    if (!best || r.played > best[1]) best = [name, r.played];
  });
  return best ? (best as [string, number])[0] : null;
}

export function PlayerCard({
  player,
  size = "md",
  className,
  interactive = true,
}: {
  player: RankedPlayer;
  size?: "sm" | "md" | "lg";
  className?: string;
  interactive?: boolean;
}) {
  const tier = tierFor(player);
  const t = TIERS[tier];
  const ovr = eloToOvr(player.elo);
  const attrs = attributes(player);
  const club = favouriteClub(player);
  const [c1, c2] = playerGradient(player.name);

  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [10, -10]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-12, 12]), { stiffness: 220, damping: 18 });
  const gx = useTransform(mx, (v) => `${v * 100}%`);
  const gy = useTransform(my, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,.45), transparent 45%)`;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  const W = { sm: 156, md: 208, lg: 264 }[size];
  const scale = W / 208;

  return (
    <div className={cn("[perspective:900px]", className)} style={{ width: W }}>
      <motion.div
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative"
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: W,
            height: W * 1.42,
            background: t.bg,
            color: t.ink,
            clipPath: "polygon(14% 0, 86% 0, 100% 6.5%, 100% 89%, 50% 100%, 0 89%, 0 6.5%)",
            filter: "drop-shadow(0 18px 30px rgba(0,0,0,.45))",
          }}
        >
          {/* inner frame */}
          <div
            className="pointer-events-none absolute inset-[6px]"
            style={{
              clipPath: "polygon(14% 0, 86% 0, 100% 6.5%, 100% 89%, 50% 100%, 0 89%, 0 6.5%)",
              boxShadow: `inset 0 0 0 1.5px ${t.line}`,
            }}
          />
          {tier === "special" && <div className="sheen pointer-events-none absolute inset-0 opacity-70" />}
          {/* foil lines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              background:
                "repeating-linear-gradient(115deg, transparent 0 14px, rgba(255,255,255,.5) 14px 15px, transparent 15px 34px)",
            }}
          />

          <div className="relative h-full" style={{ padding: `${18 * scale}px ${16 * scale}px` }}>
            {/* rating column */}
            <div className="absolute flex flex-col items-center" style={{ left: 22 * scale, top: 26 * scale }}>
              <span className="display tabular" style={{ fontSize: 46 * scale, lineHeight: 0.85 }}>
                {ovr}
              </span>
              <span className="display mt-1" style={{ fontSize: 15 * scale, color: t.sub }}>
                {player.rank ? `#${player.rank}` : "—"}
              </span>
              <span className="my-1.5 block h-px w-6" style={{ background: t.line }} />
              {club && <ClubCrest name={club} size={size === "lg" ? "md" : "sm"} />}
            </div>

            {/* portrait */}
            <div className="absolute" style={{ right: 16 * scale, top: 22 * scale }}>
              <div
                className="grid place-items-center rounded-full font-display font-bold text-white"
                style={{
                  width: 112 * scale,
                  height: 112 * scale,
                  fontSize: 56 * scale,
                  background: `linear-gradient(140deg, ${c1}, ${c2})`,
                  boxShadow: `0 0 0 ${3 * scale}px ${t.line}, 0 14px 30px -10px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.35)`,
                }}
              >
                <span className="drop-shadow-[0_2px_2px_rgba(0,0,0,.35)]">{initials(displayName(player.name))}</span>
              </div>
            </div>

            {/* name */}
            <div className="absolute inset-x-0 text-center" style={{ top: 146 * scale }}>
              <p className="display truncate px-3" style={{ fontSize: 24 * scale, letterSpacing: "0.04em" }}>
                {displayName(player.name)}
              </p>
              <div className="mx-auto mt-1 h-px w-3/4" style={{ background: t.line }} />
            </div>

            {/* attributes */}
            <div
              className="absolute inset-x-0 grid grid-cols-2"
              style={{ top: 186 * scale, columnGap: 6 * scale, rowGap: 0, padding: `0 ${30 * scale}px` }}
            >
              {attrs.map((a) => (
                <div key={a.k} className="flex items-baseline gap-1.5" title={a.t}>
                  <span className="display tabular" style={{ fontSize: 19 * scale }}>
                    {a.v}
                  </span>
                  <span className="font-display font-semibold" style={{ fontSize: 13 * scale, color: t.sub }}>
                    {a.k}
                  </span>
                </div>
              ))}
            </div>

            {/* footer */}
            <div
              className="absolute inset-x-0 text-center font-display font-bold uppercase"
              style={{ bottom: 13 * scale, fontSize: 9 * scale, letterSpacing: "0.2em", color: t.sub }}
            >
              {player.elo} Elo{player.provisional ? " · Prov." : ""}
            </div>
          </div>

          {interactive && (
            <motion.div
              className="pointer-events-none absolute inset-0 mix-blend-overlay"
              style={{ background: glare }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}
