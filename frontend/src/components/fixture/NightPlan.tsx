import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Check, Grid3x3, Play, Plus, Shuffle, SkipForward, Undo2, X } from "lucide-react";
import type { Analytics } from "../../hooks/analytics-context";
import { useBoard } from "../../hooks/useBoard";
import { useClosePlan, usePlan, useSavePlan, useSkipPlanned } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { useSessionState } from "../../hooks/useSessionState";
import { cn } from "../../lib/cn";
import { INITIAL_ELO } from "../../lib/elo";
import { DEFAULT_RULES, generateFixture, pairCounts, streakAdvice, type Fixture, type FixtureRules, type Variety } from "../../lib/fixture";
import { cleanName, displayName, relativeTime } from "../../lib/format";
import type { NightPlan as Plan, PlannedMatch } from "../../lib/types";
import { ConfirmDialog } from "../ui/Dialog";
import { Avatar } from "../ui/Identity";
import { Button, Panel, Segmented, Skeleton, Switch } from "../ui/primitives";
import { planMessages } from "./messages";

type OnPlay = (teamA: string[], teamB: string[], slot: number) => void;

function Names({ names, align = "left" }: { names: string[]; align?: "left" | "right" }) {
  return (
    // right-aligned from sm up; phones stack the sides, so both start on the left there
    <span className={cn("flex min-w-0 items-center gap-2", align === "right" && "sm:flex-row-reverse sm:text-right")}>
      <span className={cn("flex shrink-0 -space-x-2", align === "right" && "sm:flex-row-reverse sm:space-x-reverse")}>
        {names.map((n) => (
          <Avatar key={n} name={n} size="xs" className="ring-2 ring-surface" />
        ))}
      </span>
      <span className="truncate text-sm font-medium">{names.map(displayName).join(" & ")}</span>
    </span>
  );
}

function Counter({ label, value, min, max, onChange, format }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 py-1.5 pr-1.5 pl-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label={`${label} −`}>
          −
        </button>
        <span className="tabular min-w-8 text-center text-sm font-bold">{format ? format(value) : value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30" aria-label={`${label} +`}>
          +
        </button>
      </span>
    </div>
  );
}

type PairMeasure = "together" | "against";

/**
 * One hue per measure, from faint to full at the night's highest count. Every step keeps its count at
 * 4.5:1 or more in both themes: the lime skips the middle band where neither light text nor dark ink
 * reads well on the dark theme, and the blue stops before light text fades.
 */
const HEAT: Record<PairMeasure, { hue: string; step: (share: number) => number; inkFrom: number }> = {
  together: { hue: "var(--chart-1)", step: (r) => (r <= 0.5 ? 26 + 32 * r : 54 + 56 * (r - 0.5)), inkFrom: 54 },
  against: { hue: "var(--chart-7)", step: (r) => 26 + 36 * r, inkFrom: Infinity },
};

function heatCell(measure: PairMeasure, v: number, hi: number) {
  if (!v) return { className: "bg-surface-2/60 text-faint ring-1 ring-inset ring-line", style: undefined };
  const { hue, step, inkFrom } = HEAT[measure];
  const pct = Math.round(step(v / hi));
  return {
    className: cn("font-semibold text-fg", pct >= inkFrom && "dark:text-accent-ink"),
    style: { background: `color-mix(in oklab, ${hue} ${pct}%, var(--surface-2))` },
  };
}

type Count = Record<PairMeasure, number>;

/** One measure as a staircase, each name on the diagonal heading its row and column. */
function Staircase({
  measure,
  people,
  count,
  focus,
  setFocus,
}: {
  measure: PairMeasure;
  people: string[];
  count: (i: number, j: number) => Count;
  focus: [number, number] | null;
  setFocus: (f: [number, number] | null) => void;
}) {
  const t = useT(planMessages);
  const hi = Math.max(1, ...people.flatMap((_, i) => people.slice(0, i).map((_, j) => count(i, j)[measure])));
  const legend = hi <= 5 ? Array.from({ length: hi + 1 }, (_, v) => v) : [0, Math.round(hi / 3), Math.round((2 * hi) / 3), hi];
  const lit = (i: number) => !!focus && focus.includes(i);
  // room on the right for the last names, which stick out past the staircase
  const nameRoom = `${0.5 + 0.5 * Math.max(...people.map((p) => displayName(p).length))}rem`;
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <span className="size-2.5 rounded-[3px]" style={{ background: HEAT[measure].hue }} />
          {t(measure === "together" ? "pairsTogether" : "pairsAgainst")}
        </span>
        <span className="flex items-center gap-1" aria-hidden>
          {legend.map((v) => {
            const cell = heatCell(measure, v, hi);
            return (
              <span key={v} className={cn("tabular grid size-5 place-items-center rounded-md text-[10px]", cell.className)} style={cell.style}>
                {v}
              </span>
            );
          })}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        {/* square cells up to 2.25rem that shrink to fit, so the whole staircase stays in view */}
        <div
          className="relative grid w-full gap-[3px] sm:gap-1"
          style={{ gridTemplateColumns: `repeat(${people.length}, minmax(0, 2.25rem))`, paddingRight: nameRoom }}
          onMouseLeave={() => setFocus(null)}
        >
          {people.map((p, i) => (
            <Fragment key={p}>
              {people.slice(0, i).map((q, j) => {
                const c = count(i, j);
                const cell = heatCell(measure, c[measure], hi);
                // the row from this cell to its name, and the column up to the other name
                const onPath = !focus || (focus[0] === i && j >= focus[1]) || (focus[1] === j && i <= focus[0]);
                return (
                  <button
                    key={q}
                    type="button"
                    style={{ gridRow: i + 1, gridColumn: j + 1, ...cell.style }}
                    className={cn(
                      "tabular grid aspect-square place-items-center rounded-md text-[11px] transition-[opacity,box-shadow] duration-150 sm:rounded-lg sm:text-xs",
                      cell.className,
                      !onPath && "opacity-35",
                      focus?.[0] === i && focus[1] === j && "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--text)]",
                    )}
                    aria-label={t("pairTip", { a: displayName(p), b: displayName(q), ...c })}
                    onMouseEnter={() => setFocus([i, j])}
                    onFocus={() => setFocus([i, j])}
                    onBlur={() => setFocus(null)}
                    onClick={() => setFocus([i, j])}
                  >
                    {/* a quiet dot for "never", so the pairs that did happen stand out */}
                    {c[measure] || "·"}
                  </button>
                );
              })}
              <span className="relative grid aspect-square place-items-center" style={{ gridRow: i + 1, gridColumn: i + 1 }}>
                {/* as big as a cell, up to the usual small avatar */}
                <Avatar
                  name={p}
                  size="sm"
                  ring={lit(i) ? "accent" : undefined}
                  className={cn("!size-full max-h-7 max-w-7 text-[10px] transition-opacity sm:text-xs", focus && !lit(i) && "opacity-45")}
                />
                <span
                  className={cn(
                    "absolute top-1/2 left-full ml-1 -translate-y-1/2 text-[11px] whitespace-nowrap transition-colors sm:ml-1.5 sm:text-xs",
                    lit(i) ? "font-semibold text-fg" : focus ? "text-faint" : "font-medium text-muted",
                  )}
                >
                  {displayName(p)}
                </span>
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Who plays with and who against whom, side by side (stacked when narrow). Both staircases list the
 * players in the same order, and pointing at a pair lights it up in both.
 */
function PairTable({ matches }: { matches: { a: string[]; b: string[] }[] }) {
  const t = useT(planMessages);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const { together, against, key } = useMemo(() => pairCounts(matches), [matches]);
  const people = useMemo(() => [...new Set(matches.flatMap((m) => [...m.a, ...m.b]))], [matches]);
  // side by side only while each staircase keeps comfortable 26px cells, else one under the other
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const longest = Math.max(...people.map((p) => displayName(p).length));
  const oneTable = people.length * 26 + (people.length - 1) * 4 + (0.5 + 0.5 * longest) * 16;
  const sideBySide = width >= 2 * oneTable + 32;
  const count = (i: number, j: number): Count => ({
    together: together.get(key(people[i], people[j])) ?? 0,
    against: against.get(key(people[i], people[j])) ?? 0,
  });
  const pairs = people.flatMap((_, i) => people.slice(0, i).map((_, j) => count(i, j)));
  const caption = focus
    ? t("pairTip", { a: displayName(people[focus[0]]), b: displayName(people[focus[1]]), ...count(focus[0], focus[1]) })
    : t("pairsSummary", {
        tMin: Math.min(...pairs.map((c) => c.together)),
        tMax: Math.max(...pairs.map((c) => c.together)),
        oMin: Math.min(...pairs.map((c) => c.against)),
        oMax: Math.max(...pairs.map((c) => c.against)),
      });

  return (
    <div ref={box}>
      <p className="label mb-3">{t("pairsTitle")}</p>
      <div className={cn("grid gap-x-8 gap-y-6", sideBySide && "grid-cols-2")}>
        <Staircase measure="together" people={people} count={count} focus={focus} setFocus={setFocus} />
        <Staircase measure="against" people={people} count={count} focus={focus} setFocus={setFocus} />
      </div>
      <p className="mt-3 min-h-8 text-xs text-muted" aria-live="polite">
        {caption}
      </p>
    </div>
  );
}

/* ---------------------------------- Builder --------------------------------- */

function Builder({ data, present, replacing, onDone }: { data: Analytics; present: string[]; replacing: boolean; onDone: () => void }) {
  const t = useT(planMessages);
  const { slug } = useBoard();
  const save = useSavePlan();
  const names = useMemo(() => data.ranking.map((p) => p.name), [data.ranking]);
  const [selected, setSelected] = useState<string[]>(() => present.filter((n) => names.includes(n)));
  const [rules, setRules] = useSessionState<FixtureRules>(`${slug}:np-rules`, DEFAULT_RULES);
  const [draft, setDraft] = useState<Fixture | null>(null);
  const [busy, setBusy] = useState(false);
  const eloOf = (n: string) => data.eloByName.get(cleanName(n)) ?? INITIAL_ELO;
  const advice = streakAdvice(selected.length, rules.maxStreak);
  const set = <K extends keyof FixtureRules>(k: K, v: FixtureRules[K]) => {
    setRules({ ...rules, [k]: v });
    setDraft(null);
  };

  const generate = () => {
    setBusy(true);
    // let the spinner paint: a big group takes the search a second or two
    setTimeout(() => {
      const f = generateFixture(selected, rules, eloOf);
      setDraft(f);
      setBusy(false);
      if (!f) toast.error(t("noPlan"));
    }, 30);
  };

  const submit = () =>
    draft &&
    save.mutate(
      { rules, matches: draft.matches.map((m) => ({ teamA: m.a, teamB: m.b })) },
      {
        onSuccess: () => {
          toast.success(t("saved", { n: draft.matches.length }), { description: t("savedHint") });
          onDone();
        },
        onError: (e) => toast.error(t("saveFailed"), { description: (e as Error).message }),
      },
    );

  const counts = draft ? selected.map((n) => draft.matches.filter((m) => [...m.a, ...m.b].includes(n)).length) : [];

  return (
    <div className="space-y-5">
      <div>
        <p className="label mb-2">{t("who", { n: selected.length })}</p>
        <div className="flex flex-wrap gap-2">
          {names.map((n) => {
            const on = selected.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setSelected(on ? selected.filter((x) => x !== n) : [...selected, n]);
                  setDraft(null);
                }}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition-colors",
                  on ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
                )}
              >
                <Avatar name={n} size="xs" />
                {displayName(n)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Counter label={t("minPer")} value={rules.minPer} min={1} max={8} onChange={(v) => set("minPer", v)} />
        <Counter label={t("maxStreak")} value={rules.maxStreak} min={1} max={6} onChange={(v) => set("maxStreak", v)} />
        <Counter label={t("maxPartner")} value={rules.maxPartner} min={1} max={4} onChange={(v) => set("maxPartner", v)} />
        <Counter
          label={t("partnerCap")}
          value={rules.partnerCap}
          min={0}
          max={8}
          onChange={(v) => set("partnerCap", v)}
          format={(v) => (v ? String(v) : "∞")}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="flex items-center gap-2 text-xs text-muted">
          {t("variety")}
          <Segmented<Variety>
            size="sm"
            value={rules.variety}
            onChange={(v) => set("variety", v)}
            options={[
              { value: "off", label: t("varietyOff") },
              { value: "normal", label: t("varietyNormal") },
              { value: "strong", label: t("varietyStrong") },
            ]}
          />
        </span>
        <Switch checked={rules.balance} onChange={(v) => set("balance", v)} label={t("balance")} />
      </div>
      {advice && (
        <p className="flex gap-2 rounded-xl border border-draw/30 bg-draw/10 px-3 py-2 text-xs text-fg">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-draw" />
          {advice.kind === "everyone"
            ? t("adviceEveryone", { s: rules.maxStreak })
            : advice.kind === "impossible"
              ? t("adviceImpossible", { p: selected.length, rest: selected.length - 4, s: rules.maxStreak, need: advice.need, fair: advice.fair })
              : t("adviceSameRest", { p: selected.length, s: rules.maxStreak, next: advice.next })}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {t("cancel")}
        </Button>
        <Button variant={draft ? "secondary" : "primary"} onClick={generate} loading={busy} disabled={selected.length < 4}>
          {!busy && <Shuffle className="size-4" />} {draft ? t("again") : t("generate")}
        </Button>
      </div>
      {selected.length < 4 && <p className="text-right text-xs text-muted">{t("needFour")}</p>}

      <AnimatePresence>
        {draft && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="hairline" />
            <p className="text-sm">
              <span className="font-semibold">{t("draftSummary", { n: draft.matches.length, min: Math.min(...counts), max: Math.max(...counts) })}</span>
              {draft.violations > 0 && <span className="ml-2 text-draw">{t("broken", { n: draft.violations })}</span>}
            </p>
            <ol className="space-y-1.5">
              {draft.matches.map((m, i) => (
                <li key={i} className={cn("grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-2 rounded-xl px-2 py-1.5", m.violations ? "bg-draw/10" : "bg-surface-2/50")}>
                  <span className="tabular font-display text-base font-bold text-faint">{i + 1}</span>
                  <span className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-2">
                    <Names names={m.a} />
                    <span className="hidden text-[10px] font-bold text-faint sm:block">VS</span>
                    <Names names={m.b} align="right" />
                  </span>
                </li>
              ))}
            </ol>
            <PairTable matches={draft.matches} />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {replacing && <span className="text-xs text-muted">{t("replaces")}</span>}
              <Button variant="primary" onClick={submit} loading={save.isPending}>
                <Check className="size-4" /> {t("save")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------- View ----------------------------------- */

function PlannedRow({ m, index, next, data, onPlay }: { m: PlannedMatch; index: number; next: boolean; data: Analytics; onPlay: OnPlay }) {
  const t = useT(planMessages);
  const skip = useSkipPlanned();
  const played = m.matchId != null ? data.parsed.find((x) => x.id === m.matchId) : undefined;
  const flipped = played ? !played.teamA.includes(m.teamA[0]) : false;
  const score = played ? (flipped ? [played.scoreB, played.scoreA] : [played.scoreA, played.scoreB]) : null;
  const status = (
    <span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", played ? "bg-win/15 text-win" : next ? "bg-accent text-accent-ink" : "text-faint")}>
      {played ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
    </span>
  );
  const actions = (
    <span className="flex justify-end gap-0.5">
      {!played && !m.skipped && (
        <>
          <Button size="sm" variant={next ? "primary" : "ghost"} onClick={() => onPlay(m.teamA, m.teamB, m.slot)} aria-label={t("playThis")}>
            <Play className="size-3.5" /> <span className="max-sm:sr-only">{t("play")}</span>
          </Button>
          <Button size="sm" variant="ghost" className="px-2" onClick={() => skip.mutate({ slot: m.slot, skipped: true })} title={t("skip")} aria-label={t("skip")}>
            <SkipForward className="size-3.5" />
          </Button>
        </>
      )}
      {m.skipped && (
        <Button size="sm" variant="ghost" className="px-2" onClick={() => skip.mutate({ slot: m.slot, skipped: false })} title={t("unskip")} aria-label={t("unskip")}>
          <Undo2 className="size-3.5" />
        </Button>
      )}
    </span>
  );
  const sideLine = (names: string[], tone: "a" | "b", goals?: number) => (
    <span className="flex items-center gap-2">
      <span className={cn("size-1.5 shrink-0 rounded-full", tone === "a" ? "bg-team-a" : "bg-team-b")} />
      <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", m.skipped && "line-through")}>{names.map(displayName).join(" & ")}</span>
      {goals != null && <span className="tabular font-display text-base font-bold">{goals}</span>}
    </span>
  );
  return (
    <li
      className={cn(
        "rounded-xl px-2 py-2 transition-colors",
        next ? "bg-accent/10 ring-1 ring-accent/40" : played ? "opacity-70" : "hover:bg-surface-2/50",
        m.skipped && "opacity-45",
      )}
    >
      {/* phones: the two sides one under the other */}
      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-2 sm:hidden">
        {status}
        <span className="min-w-0 space-y-0.5">
          {sideLine(m.teamA, "a", score?.[0])}
          {sideLine(m.teamB, "b", score?.[1])}
        </span>
        {actions}
      </div>
      <div className="hidden grid-cols-[1.75rem_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 sm:grid">
        {status}
        <span className={cn("min-w-0", m.skipped && "line-through")}>
          <Names names={m.teamA} />
        </span>
        <span className={cn("tabular rounded-md px-1.5 text-center font-display font-bold", score ? "bg-surface-3 text-sm" : "text-[10px] text-faint")}>
          {score ? `${score[0]}–${score[1]}` : "VS"}
        </span>
        <span className={cn("min-w-0", m.skipped && "line-through")}>
          <Names names={m.teamB} align="right" />
        </span>
        {actions}
      </div>
    </li>
  );
}

function PlanView({ plan, data, onPlay, onNew }: { plan: Plan; data: Analytics; onPlay: OnPlay; onNew: () => void }) {
  const t = useT(planMessages);
  const close = useClosePlan();
  const [pairs, setPairs] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const open = plan.matches.filter((m) => m.matchId == null && !m.skipped);
  const played = plan.matches.filter((m) => m.matchId != null).length;
  const next = open[0];
  return (
    <Panel
      title={t("title")}
      subtitle={t("progress", { played, total: plan.matches.length - plan.matches.filter((m) => m.skipped).length, when: relativeTime(new Date(plan.createdAt)) })}
      icon={<CalendarClock className="size-4" />}
      action={
        <span className="flex gap-0.5">
          <Button size="icon" variant={pairs ? "secondary" : "ghost"} onClick={() => setPairs((p) => !p)} title={t("pairsTitle")} aria-label={t("pairsTitle")} aria-pressed={pairs}>
            <Grid3x3 className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onNew} title={t("newPlan")} aria-label={t("newPlan")}>
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setConfirm(true)} title={t("finish")} aria-label={t("finish")}>
            <X className="size-4" />
          </Button>
        </span>
      }
      bodyClassName="p-3 sm:p-5"
    >
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${(played / Math.max(1, played + open.length)) * 100}%` }} />
      </div>
      {!next && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-win/30 bg-win/10 px-4 py-3 text-sm">
          <span>{t("allDone")}</span>
          <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
            {t("finish")}
          </Button>
        </div>
      )}
      <ol className="space-y-1">
        {plan.matches.map((m, i) => (
          <PlannedRow key={m.slot} m={m} index={i} next={m === next} data={data} onPlay={onPlay} />
        ))}
      </ol>
      {pairs && (
        <div className="mt-5">
          <PairTable matches={plan.matches.map((m) => ({ a: m.teamA, b: m.teamB }))} />
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        tone="accent"
        confirmLabel={t("finish")}
        loading={close.isPending}
        title={t("finishTitle")}
        description={t("finishHint")}
        onConfirm={() => close.mutate(undefined, { onSettled: () => setConfirm(false) })}
      />
    </Panel>
  );
}

/** The night's plan at the top of the Match Center. */
export function NightPlan({ data, present, onPlay }: { data: Analytics; present: string[]; onPlay: OnPlay }) {
  const t = useT(planMessages);
  const plan = usePlan();
  const [building, setBuilding] = useState(false);

  if (plan.isLoading) return <Skeleton className="h-24 rounded-2xl" />;

  if (building || !plan.data) {
    return (
      <Panel title={t("title")} subtitle={t("subtitle")} icon={<CalendarClock className="size-4" />} bodyClassName={building ? "p-3.5 sm:p-5" : "px-5 pb-5"}>
        {building ? (
          <Builder data={data} present={present} replacing={!!plan.data} onDone={() => setBuilding(false)} />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">{t("pitch")}</p>
            <Button variant="secondary" onClick={() => setBuilding(true)}>
              <CalendarClock className="size-4" /> {t("create")}
            </Button>
          </div>
        )}
      </Panel>
    );
  }
  return <PlanView plan={plan.data} data={data} onPlay={onPlay} onNew={() => setBuilding(true)} />;
}

