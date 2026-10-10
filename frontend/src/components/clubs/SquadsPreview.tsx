import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Shirt, Shuffle, X } from "lucide-react";
import { useCards } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { STATS, type Card, type ClubEvaluation, type SlotKey } from "../../lib/clubModel";
import { referenceSeason, runModel, type ClubRecord } from "../../lib/clubs";
import { expectedScore } from "../../lib/elo";
import { displayName } from "../../lib/format";
import type { Season, Side } from "../../lib/types";
import { Modal } from "../ui/Dialog";
import { Avatar, ClubCrest } from "../ui/Identity";
import { Button, Segmented, Skeleton } from "../ui/primitives";
import { ClubForm } from "./ClubForm";
import { clubMessages } from "./messages";
import { Bench, CardFace, Pitch } from "./Pitch";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** The lines of the eleven, front to back. */
const LINES: { key: "lineXi" | "lineAtt" | "lineMid" | "lineDef" | "lineGk"; of: (r: ClubEvaluation) => number | null }[] = [
  { key: "lineXi", of: (r) => r.ovr },
  { key: "lineAtt", of: (r) => mean((["ST", "W"] as SlotKey[]).map((s) => r.slotAvg[s])) },
  { key: "lineMid", of: (r) => r.slotAvg.MID },
  { key: "lineDef", of: (r) => mean((["CB", "FB"] as SlotKey[]).map((s) => r.slotAvg[s])) },
  { key: "lineGk", of: (r) => r.slotAvg.GK },
];

/**
 * Bars start where every squad looks alike (60 overall, 40 for a stat), so a point of difference stays
 * visible.
 */
const barWidth = (v: number | null, from: number, to: number) => (v == null ? 0 : Math.max(4, Math.min(100, ((v - from) / (to - from)) * 100)));

interface CompareRow {
  key: string;
  label: string;
  title?: string;
  a: number | null;
  b: number | null;
  digits: number;
  from: number;
  to: number;
}

/** One side's numbers against the other's, bars growing out from the middle. */
function CompareGroup({ title, rows, loaded }: { title: string; rows: CompareRow[]; loaded: boolean }) {
  return (
    <div className="min-w-0">
      <p className="label mb-2.5 text-center">{title}</p>
      <div className="space-y-2">
        {rows.map((r) => {
          const better = r.a != null && r.b != null ? Math.sign(Math.round(r.a * 10) - Math.round(r.b * 10)) : 0;
          return (
            <div key={r.key} className="grid grid-cols-[2.5rem_1fr_5.25rem_1fr_2.5rem] items-center gap-2 text-sm" title={r.title}>
              <span className={cn("tabular text-right", better > 0 ? "font-bold text-fg" : "text-muted")}>{r.a?.toFixed(r.digits) ?? "—"}</span>
              <span className="flex h-1.5 justify-end overflow-hidden rounded-full bg-surface-3">
                {loaded && <span className={cn("rounded-full bg-team-a", better < 0 && "opacity-45")} style={{ width: `${barWidth(r.a, r.from, r.to)}%` }} />}
              </span>
              <span className="truncate text-center text-[11px] font-semibold text-faint uppercase">{r.label}</span>
              <span className="flex h-1.5 overflow-hidden rounded-full bg-surface-3">
                {loaded && <span className={cn("rounded-full bg-team-b", better > 0 && "opacity-45")} style={{ width: `${barWidth(r.b, r.from, r.to)}%` }} />}
              </span>
              <span className={cn("tabular", better < 0 ? "font-bold text-fg" : "text-muted")}>{r.b?.toFixed(r.digits) ?? "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SideHead({ side, club, elo, players, record }: { side: Side; club: string; elo?: number; players: string[]; record?: ClubRecord }) {
  const t = useT(clubMessages);
  return (
    // phones stack each side under its crest, so names get the whole width
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-line bg-surface-2/60 p-3 max-sm:text-center",
        side === "A" ? "shadow-[inset_3px_0_0_var(--team-a)]" : "shadow-[inset_-3px_0_0_var(--team-b)] sm:text-right",
      )}
    >
      <div className={cn("flex items-center gap-2.5 max-sm:flex-col max-sm:gap-1.5", side === "B" && "sm:flex-row-reverse")}>
        <ClubCrest name={club} size="md" className="sm:hidden" />
        <ClubCrest name={club} size="lg" className="max-sm:hidden" />
        <div className="min-w-0 max-sm:w-full">
          <p className="text-sm leading-tight font-semibold max-sm:line-clamp-2 sm:truncate sm:text-base">{club}</p>
          {elo != null && <p className="tabular mt-0.5 text-xs text-muted">{t("elo")} {elo}</p>}
        </div>
      </div>
      {record && (
        <ClubForm record={record} align={side === "B" ? "end" : "start"} className="mt-2.5 max-sm:justify-center" />
      )}
      {players.length > 0 && (
        <div className={cn("mt-2.5 flex min-w-0 items-center gap-2 max-sm:flex-col max-sm:gap-1", side === "B" && "sm:flex-row-reverse")}>
          <span className={cn("flex shrink-0 -space-x-1.5", side === "B" && "sm:flex-row-reverse sm:space-x-reverse")}>
            {players.map((n) => (
              <Avatar key={n} name={n} size="xs" className="ring-2 ring-surface-2" />
            ))}
          </span>
          <span className="truncate text-xs text-muted max-sm:max-w-full">{players.map(displayName).join(" & ")}</span>
        </div>
      )}
    </div>
  );
}

/** Cards outside a club's matchday squad, best first. */
function OtherCards({ game, side, cards, className }: { game: string; side: Side; cards: Card[]; className?: string }) {
  const t = useT(clubMessages);
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-line bg-surface-2/40 p-2",
        side === "A" ? "shadow-[inset_3px_0_0_var(--team-a)]" : "shadow-[inset_3px_0_0_var(--team-b)]",
        className,
      )}
    >
      <p className="label px-2 pt-1 pb-2">{t("others", { n: cards.length })}</p>
      <ul className="space-y-0.5">
        {cards.map((c) => (
          <li key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2" title={c.fullName}>
            <CardFace game={game} card={c} size={30} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
            <span className="text-[11px] font-semibold whitespace-nowrap text-muted">{[c.pos, ...c.alt].join(" · ")}</span>
            <span className="tabular w-7 text-right font-display text-base font-bold">{c.ovr}</span>
          </li>
        ))}
        {!cards.length && <li className="px-2 py-3 text-center text-xs text-faint">—</li>}
      </ul>
    </div>
  );
}

/**
 * The two clubs of the Match Center side by side: who plays them, the win chance, the eleven line
 * by line and both pitches. Closing changes nothing; a new balanced pairing can be drawn from here.
 */
export function SquadsPreview({
  open,
  onClose,
  season,
  seasons,
  clubs,
  teams,
  records,
  chance,
  note,
  onReroll,
}: {
  open: boolean;
  onClose: () => void;
  season: Season;
  seasons: Season[];
  clubs: [string, string];
  /** who plays each club, in the same order */
  teams: [string[], string[]];
  /** how the group has done with each club, in the same order */
  records?: [ClubRecord, ClubRecord];
  /** side A's win chance with these players and clubs; null when a side has no players yet */
  chance: number | null;
  /** how fair the last balanced pick was */
  note?: string | null;
  onReroll?: () => void;
}) {
  const t = useT(clubMessages);
  const [phoneSide, setPhoneSide] = useState<Side>("A");
  const [others, setOthers] = useState(false);
  const othersRef = useRef<HTMLDivElement>(null);
  const cards = useCards(open ? season.game : null);
  const rated = useMemo(() => {
    if (!cards.data) return null;
    const result = runModel(cards.data, season.model, referenceSeason(seasons, season));
    return clubs.map((name) => result.rows.find((r) => same(r.club.name, name)) ?? null);
  }, [cards.data, season, seasons, clubs]);
  const elos = clubs.map((name) => season.clubs.find((c) => same(c.name, name))?.elo);
  const pA = chance ?? (elos[0] != null && elos[1] != null ? expectedScore(elos[0] / 2, elos[1] / 2) : null);
  const [ra, rb] = rated ?? [null, null];

  return (
    <Modal open={open} onClose={onClose} labelledBy="squads-title" wide>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent-text ring-1 ring-accent/25">
            <Shirt className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 id="squads-title" className="font-semibold">
              {t("mcTitle")}
            </h3>
            <p className="truncate text-xs text-muted">{t("mcSub", { season: season.name })}</p>
          </div>
        </div>
        <button onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg" aria-label={t("clear")}>
          <X className="size-4" />
        </button>
      </div>

      {/* a new pairing fades in where the old one was */}
      <motion.div key={clubs.join("|")} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
          <SideHead side="A" club={clubs[0]} elo={elos[0]} players={teams[0]} record={records?.[0]} />
          <span className="font-display text-xs font-bold text-faint">VS</span>
          <SideHead side="B" club={clubs[1]} elo={elos[1]} players={teams[1]} record={records?.[1]} />
        </div>

        <div className="mt-3 rounded-2xl border border-line bg-surface-2/40 p-4">
          {pA != null && (
            <div>
              <p className="label mb-2 text-center text-balance">{chance != null ? t("mcChance") : t("winChance")}</p>
              <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-3">
                <span className="display tabular text-xl text-team-a">{Math.round(pA * 100)}%</span>
                <span className="flex h-2 gap-1 overflow-hidden rounded-full">
                  <span className="rounded-l-full bg-team-a" style={{ width: `${pA * 100}%` }} />
                  <span className="flex-1 rounded-r-full bg-team-b" />
                </span>
                <span className="display tabular text-right text-xl text-team-b">{100 - Math.round(pA * 100)}%</span>
              </div>
              {note && <p className="mt-2 text-center text-[11px] text-faint">{note}</p>}
            </div>
          )}
          {/* the eleven line by line, and its outfield card stats */}
          <div className={cn("grid gap-x-8 gap-y-5 sm:grid-cols-2", pA != null && "mt-5")}>
            <CompareGroup
              title={t("mcLines")}
              loaded={!!rated}
              rows={LINES.map((line) => ({
                key: line.key,
                label: t(line.key),
                a: ra ? line.of(ra) : null,
                b: rb ? line.of(rb) : null,
                digits: 1,
                from: 60,
                to: 92,
              }))}
            />
            <CompareGroup
              title={t("mcStats")}
              loaded={!!rated}
              rows={STATS.map((k) => ({
                key: k,
                label: k,
                title: t(`stat${k}`),
                a: ra?.stats[k] ?? null,
                b: rb?.stats[k] ?? null,
                digits: 0,
                from: 40,
                to: 95,
              }))}
            />
          </div>
        </div>

        {/* phones show one pitch at a time */}
        <Segmented<Side>
          className="mt-4 flex w-full sm:hidden [&>button]:flex-1"
          value={phoneSide}
          onChange={setPhoneSide}
          options={(["A", "B"] as Side[]).map((s, i) => ({
            value: s,
            label: (
              <span className="flex min-w-0 items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", s === "A" ? "bg-team-a" : "bg-team-b")} />
                <span className="truncate">{clubs[i]}</span>
              </span>
            ),
          }))}
        />
        <div className="mt-3 grid gap-4 sm:mt-4 sm:grid-cols-2">
          {clubs.map((name, i) => {
            const r = rated?.[i];
            return (
              <div key={name} className={cn("min-w-0 space-y-2", (i === 0 ? "B" : "A") === phoneSide && "max-sm:hidden")}>
                {!rated ? (
                  <Skeleton className="aspect-[4/5] rounded-2xl" />
                ) : r ? (
                  <>
                    <Pitch game={season.game!} evaluation={r} compact className="aspect-[4/5]" />
                    <Bench game={season.game!} bench={r.bench} compact />
                  </>
                ) : (
                  <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">—</p>
                )}
              </div>
            );
          })}
        </div>

        {/* the rest of each squad, on request */}
        {ra && rb && (ra.outside.length > 0 || rb.outside.length > 0) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                setOthers((o) => !o);
                if (!others) setTimeout(() => othersRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 220);
              }}
              aria-expanded={others}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {others ? t("mcOthersHide") : t("mcOthersShow")}
              <span className="tabular text-xs text-faint max-sm:hidden">
                {ra.outside.length} · {rb.outside.length}
              </span>
              <ChevronDown className={cn("size-4 transition-transform", others && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {others && (
                <motion.div
                  ref={othersRef}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-4 pt-3 sm:grid-cols-2">
                    {[ra, rb].map((r, i) => (
                      <OtherCards
                        key={r.club.eaId}
                        game={season.game!}
                        side={i === 0 ? "A" : "B"}
                        cards={r.outside}
                        className={cn((i === 0 ? "B" : "A") === phoneSide && "max-sm:hidden")}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* stays in reach while the pitches scroll */}
      <div className="sticky -bottom-4 z-10 -mx-4 mt-5 -mb-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6">
        <p className="mr-auto basis-full text-xs text-muted sm:basis-auto">{t("mcKeep")}</p>
        {onReroll && (
          <Button variant="secondary" onClick={onReroll} className="max-sm:flex-1">
            <Shuffle className="size-4" /> {t("mcReroll")}
          </Button>
        )}
        <Button variant="primary" onClick={onClose} className="max-sm:flex-1">
          <Check className="size-4" /> {t("mcDone")}
        </Button>
      </div>
    </Modal>
  );
}
