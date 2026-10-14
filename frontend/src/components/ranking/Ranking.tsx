import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { RankedPlayer } from "../../hooks/analytics-context";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import { nightlyElo } from "../../lib/insights";
import { winRate } from "../../lib/stats";
import { BoardLink } from "../board/BoardLink";
import { Avatar } from "../ui/Identity";
import { Sparkline } from "../ui/primitives";

const m = defineMessages({
  en: {
    record: "{n} matches · {pct}%",
    progress: "{n}/{need} matches",
    newPlayers: "{n} new player|{n} new players",
    newHint: "Ranked after {need} matches",
    eloChange: "Elo since the last match night",
  },
  tr: {
    record: "{n} maç · %{pct}",
    progress: "{n}/{need} maç",
    newPlayers: "{n} yeni oyuncu|{n} yeni oyuncu",
    newHint: "{need} maçı doldurunca sıralamaya girer",
    eloChange: "Son maç gecesinden beri Elo",
  },
});

/** Last match night's Elo change as a green or red chip; nothing if the player sat it out. */
export function EloChip({ value }: { value: number }) {
  const t = useT(m);
  if (!value) return null;
  return (
    <span
      title={t("eloChange")}
      className={cn(
        "tabular rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        value > 0 ? "bg-win/12 text-win" : "bg-loss/12 text-loss",
      )}
    >
      {value > 0 ? "+" : "−"}
      {Math.abs(value)}
    </span>
  );
}

/** One player in a ranking: rank, record, an Elo line per night, Elo and last night's change. */
export function RankingRow({ player: p, rankedAfter }: { player: RankedPlayer; rankedAfter: number }) {
  const t = useT(m);
  const played = p.stats?.played ?? 0;
  return (
    <BoardLink
      to={`/players/${encodeURIComponent(p.name)}`}
      className="group flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2"
    >
      <span
        className={cn(
          "display tabular w-5 shrink-0 text-center text-lg",
          p.rank === 1 ? "text-gold" : p.rank === 2 ? "text-silver" : p.rank === 3 ? "text-bronze" : "text-faint",
        )}
      >
        {p.rank || "–"}
      </span>
      <Avatar name={p.name} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{displayName(p.name)}</span>
        <span className="tabular block truncate text-[11px] text-faint">
          {p.provisional
            ? t("progress", { n: played, need: rankedAfter })
            : t("record", { n: played, pct: p.stats ? winRate(p.stats).toFixed(0) : 0 })}
        </span>
      </span>
      <Sparkline values={nightlyElo(p.history).slice(-12)} width={56} height={22} className="shrink-0" />
      <span className="display tabular w-11 shrink-0 text-right text-xl">{p.elo}</span>
      <span className="w-10 shrink-0 text-right">
        <EloChip value={p.eloDelta} />
      </span>
    </BoardLink>
  );
}

/** Players who haven't played enough for a rank yet, folded under one line. */
export function NewPlayers({ players, rankedAfter }: { players: RankedPlayer[]; rankedAfter: number }) {
  const t = useT(m);
  const [open, setOpen] = useState(false);
  if (!players.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
      >
        <span className="flex shrink-0 -space-x-2">
          {players.slice(0, 5).map((p) => (
            <Avatar key={p.id} name={p.name} size="sm" className="ring-2 ring-surface" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{t("newPlayers", { n: players.length })}</span>
          <span className="block truncate text-[11px] text-faint">{t("newHint", { need: rankedAfter })}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {players.map((p) => (
              <li key={p.id}>
                <RankingRow player={p} rankedAfter={rankedAfter} />
              </li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>
    </div>
  );
}
