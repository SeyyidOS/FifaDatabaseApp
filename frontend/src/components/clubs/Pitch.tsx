import { useState } from "react";
import { cn } from "../../lib/cn";
import type { BenchPlace, Card, ClubEvaluation, SlotKey } from "../../lib/clubModel";
import { faceUrl, pace } from "../../lib/clubs";
import { defineMessages } from "../../lib/i18n";
import { initials } from "../../lib/identity";
import { useT } from "../../hooks/useI18n";
import { slotMessages } from "./messages";

const m = defineMessages({
  en: { altPos: "{name} plays out of position: {pos} → {slot}", empty: "No {slot} in the squad", bench: "Substitutes", pace: "Pace" },
  tr: { altPos: "{name} yan mevkide: {pos} → {slot}", empty: "Kadroda {slot} yok", bench: "Yedekler", pace: "Hız" },
});

const QUALITY: Record<string, string> = {
  gold: "ring-[#e4bb4f]",
  silver: "ring-[#c9d1da]",
  bronze: "ring-[#c98756]",
};

/** A card's face, falling back to initials (sizes in px). */
export function CardFace({ game, card, size = 48, className }: { game: string; card: Card; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-b from-white/25 to-white/5 ring-2",
        QUALITY[card.quality ?? ""] ?? "ring-white/40",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {broken ? (
        <span className="font-display font-bold text-white" style={{ fontSize: size * 0.36 }}>
          {initials(card.name)}
        </span>
      ) : (
        <img
          src={faceUrl(game, card.id)}
          alt=""
          loading="lazy"
          decoding="async"
          width={size}
          height={size}
          onError={() => setBroken(true)}
          className="size-full object-cover object-top"
        />
      )}
    </span>
  );
}

function PitchCard({ game, card, label, alt, slot, compact }: { game: string; card: Card; label: string; alt?: boolean; slot: SlotKey; compact?: boolean }) {
  const t = useT(m);
  const ts = useT(slotMessages);
  return (
    <div
      className={cn("flex flex-col items-center text-center", compact ? "w-[58px]" : "w-[64px] sm:w-[78px]")}
      title={alt ? t("altPos", { name: card.fullName, pos: card.pos, slot: ts(`${slot}n`) }) : card.fullName}
    >
      <div className="relative">
        <CardFace game={game} card={card} size={compact ? 40 : 46} className={compact ? "" : "sm:!size-[54px]"} />
        <span className="tabular absolute -top-1 -left-2 rounded-md bg-black/75 px-1 py-px font-display text-[12px] font-bold leading-none text-white ring-1 ring-white/20">
          {card.ovr}
        </span>
      </div>
      <span className="mt-1 max-w-full truncate text-[11px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.7)] sm:text-xs">
        {card.name}
      </span>
      <span className={cn("text-[9px] font-bold tracking-wide", alt ? "text-amber-300" : "text-white/60")}>
        {alt ? `${card.pos}→${label}` : label}
      </span>
      {pace(card) != null && (
        <span className="tabular text-[9px] font-semibold text-white/85 sm:text-[10px]" title={t("pace")}>
          PAC {pace(card)}
        </span>
      )}
    </div>
  );
}

function EmptySpot({ slot, compact }: { slot: SlotKey; compact?: boolean }) {
  const t = useT(m);
  const ts = useT(slotMessages);
  return (
    <div className={cn("flex flex-col items-center", compact ? "w-[58px]" : "w-[64px] sm:w-[78px]")} title={t("empty", { slot: ts(`${slot}n`) })}>
      <span
        className="grid place-items-center rounded-full border-2 border-dashed border-amber-300/70 font-display text-xs font-bold text-amber-200"
        style={{ width: compact ? 40 : 46, height: compact ? 40 : 46 }}
      >
        {ts(slot)}
      </span>
    </div>
  );
}

/** The eleven on a pitch, attack at the top. */
export function Pitch({ game, evaluation, compact, className }: { game: string; evaluation: ClubEvaluation; compact?: boolean; className?: string }) {
  const rows = [0, 1, 2, 3].map((row) => evaluation.xi.filter((e) => e.spot.row === row));
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl ring-1 ring-black/20",
        "bg-[repeating-linear-gradient(180deg,#1f6b3a_0_12.5%,#1b6034_12.5%_25%)]",
        className,
      )}
    >
      {/* markings */}
      <svg viewBox="0 0 100 140" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full text-white/25" fill="none" stroke="currentColor" strokeWidth="0.5">
        <rect x="3" y="3" width="94" height="134" />
        <line x1="3" y1="70" x2="97" y2="70" />
        <circle cx="50" cy="70" r="11" />
        <rect x="24" y="3" width="52" height="20" />
        <rect x="24" y="117" width="52" height="20" />
        <rect x="38" y="3" width="24" height="7" />
        <rect x="38" y="130" width="24" height="7" />
      </svg>
      <div className={cn("relative grid h-full grid-rows-4 gap-2", compact ? "px-1 py-3" : "px-2 py-5 sm:px-4")}>
        {rows.map((row, i) => (
          <div key={i} className={cn("flex items-center", row.length > 2 ? "justify-around" : "justify-evenly")}>
            {row.map((e) =>
              e.p ? (
                <PitchCard key={e.spot.id} game={game} card={e.p} label={e.spot.label ?? e.spot.id} alt={e.alt} slot={e.spot.g} compact={compact} />
              ) : (
                <EmptySpot key={e.spot.id} slot={e.spot.g} compact={compact} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Substitutes in a row under the pitch. */
export function Bench({ game, bench, compact }: { game: string; bench: BenchPlace[]; compact?: boolean }) {
  const t = useT(m);
  const ts = useT(slotMessages);
  if (!bench.length) return null;
  return (
    <div className="rounded-2xl bg-[#174f2c] px-3 py-3 ring-1 ring-black/20">
      <p className="mb-2 text-center text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase">{t("bench")}</p>
      <div className="flex justify-center gap-2 sm:gap-4">
        {bench.map((b, i) =>
          b.p ? (
            <PitchCard key={i} game={game} card={b.p} label={ts(b.slot)} alt={b.alt} slot={b.slot} compact={compact} />
          ) : (
            <EmptySpot key={i} slot={b.slot} compact={compact} />
          ),
        )}
      </div>
    </div>
  );
}
