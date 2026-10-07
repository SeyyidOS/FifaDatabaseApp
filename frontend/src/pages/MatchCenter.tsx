import confetti from "canvas-confetti";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Dices,
  Minus,
  Plus,
  RotateCcw,
  Scale,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { AddPlayer } from "../components/AddPlayer";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { MatchCard } from "../components/match/MatchCard";
import { ClubPicker } from "../components/ui/ClubPicker";
import { Avatar, ClubCrest } from "../components/ui/Identity";
import { Button, Delta, EmptyState, Panel, Pill, Segmented, Switch } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useAddMatch } from "../hooks/useData";
import { useBoard } from "../hooks/useBoard";
import { useSessionState } from "../hooks/useSessionState";
import { choiceName, type ClubChoice } from "../lib/clubChoice";
import { cn } from "../lib/cn";
import { INITIAL_ELO, previewMatch } from "../lib/elo";
import { cleanName, displayName, matchdayKey } from "../lib/format";
import {
  generateTeams,
  lastTeammates,
  pickBalancedClubs,
  teamAverage,
  type TeamMode,
} from "../lib/matchmaking";
import type { Side } from "../lib/types";

const sideColor = (s: Side) => (s === "A" ? "var(--team-a)" : "var(--team-b)");

function burst(side: Side | "D") {
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c8ff3d";
  const colors =
    side === "D"
      ? [accent, "#fbbf24", "#ffffff"]
      : [side === "A" ? "#22d3ee" : "#a78bfa", accent, "#ffffff"];
  const opts = { particleCount: 90, spread: 70, startVelocity: 48, colors, disableForReducedMotion: true };
  confetti({ ...opts, angle: 60, origin: { x: 0, y: 0.75 } });
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.75 } });
}

/* ------------------------------- Pool chip --------------------------------- */

function PoolChip({
  name,
  elo,
  present,
  side,
  onTogglePresent,
  onAssign,
}: {
  name: string;
  elo: number;
  present: boolean;
  side: Side | null;
  onTogglePresent: () => void;
  onAssign: (s: Side) => void;
}) {
  return (
    <motion.div
      layout
      className={cn(
        "group relative flex min-w-0 items-center gap-2 rounded-xl border bg-surface-2 py-2 pl-2 pr-1.5 transition-colors sm:gap-2.5",
        present ? "border-line hover:border-line-strong" : "border-dashed border-line opacity-45",
        side === "A" && "border-team-a/60 bg-team-a/[0.07]",
        side === "B" && "border-team-b/60 bg-team-b/[0.07]",
      )}
    >
      <button
        onClick={onTogglePresent}
        className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-2.5"
        title={present ? "Mark as not here" : "Mark as here"}
      >
        <Avatar name={name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{displayName(name)}</span>
          <span className="tabular block text-[11px] text-muted">{elo}</span>
        </span>
      </button>
      <span className="flex gap-1">
        {(["A", "B"] as Side[]).map((s) => (
          <button
            key={s}
            onClick={() => onAssign(s)}
            disabled={!present}
            className={cn(
              "grid size-7 place-items-center rounded-lg font-display text-sm font-bold transition-all",
              side === s ? "text-bg" : "bg-surface-3 text-muted hover:text-fg",
            )}
            style={side === s ? { background: sideColor(s) } : undefined}
            aria-label={`Assign to side ${s}`}
          >
            {s}
          </button>
        ))}
      </span>
    </motion.div>
  );
}

/* ------------------------------- Team panel -------------------------------- */

function TeamPanel({
  side,
  names,
  eloByName,
  onRemove,
}: {
  side: Side;
  names: string[];
  eloByName: Map<string, number>;
  onRemove: (n: string) => void;
}) {
  const avg = Math.round(teamAverage(names, eloByName));
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-line bg-surface-2/60 p-4"
      style={{ boxShadow: `inset 0 2px 0 ${sideColor(side)}` }}
    >
      <div
        className="pointer-events-none absolute -top-16 left-1/2 size-40 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: sideColor(side), opacity: 0.12 }}
      />
      <div className="relative mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: sideColor(side) }} />
          <span className="display text-lg">Side {side}</span>
        </span>
        {names.length > 0 && (
          <span className="text-xs text-muted">
            avg <span className="tabular font-semibold text-fg">{avg}</span>
          </span>
        )}
      </div>
      <div className="relative min-h-[104px] space-y-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {names.map((n) => (
            <motion.div
              layout
              layoutId={`team-${n}`}
              key={n}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
              className="flex items-center gap-3 rounded-xl bg-surface px-2.5 py-2 ring-1 ring-line"
            >
              <Avatar name={n} size="md" ring={side === "A" ? "a" : "b"} />
              <span className="flex-1 font-semibold">{displayName(n)}</span>
              <span className="tabular text-sm text-muted">{eloByName.get(cleanName(n)) ?? INITIAL_ELO}</span>
              <button onClick={() => onRemove(n)} className="rounded-md p-1 text-faint hover:bg-surface-3 hover:text-fg" aria-label="Remove">
                <X className="size-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        {!names.length && (
          <div className="grid h-[104px] place-items-center rounded-xl border border-dashed border-line text-center text-xs text-faint">
            Tap {side} on a player
            <br />
            or shuffle teams
          </div>
        )}
      </div>
    </div>
  );
}

function WinProbability({ pA, withClubs }: { pA: number; withClubs: boolean }) {
  const a = Math.round(pA * 100);
  const b = 100 - a;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="display tabular text-2xl" style={{ color: sideColor("A") }}>
          {a}%
        </span>
        <span className="label">{withClubs ? "Win probability · incl. clubs" : "Win probability · squads only"}</span>
        <span className="display tabular text-2xl" style={{ color: sideColor("B") }}>
          {b}%
        </span>
      </div>
      <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
        <motion.div
          className="h-full rounded-l-full"
          style={{ background: sideColor("A") }}
          animate={{ width: `${a}%` }}
          transition={{ type: "spring", bounce: 0.1, duration: 0.8 }}
        />
        <motion.div
          className="h-full flex-1 rounded-r-full"
          style={{ background: sideColor("B") }}
        />
      </div>
    </div>
  );
}

/* -------------------------------- Scoreboard -------------------------------- */

function Stepper({ value, onChange, side }: { value: number; onChange: (v: number) => void; side: Side }) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid size-9 place-items-center rounded-xl bg-surface-3 text-muted transition-colors hover:text-fg active:scale-95"
        aria-label="Decrease"
      >
        <Minus className="size-4" />
      </button>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const v = parseInt(e.target.value.replace(/\D/g, ""), 10);
          onChange(Number.isFinite(v) ? Math.min(99, v) : 0);
        }}
        onFocus={(e) => e.target.select()}
        className="display tabular w-14 bg-transparent text-center text-5xl outline-none"
        style={{ color: sideColor(side) }}
        aria-label={`Side ${side} score`}
      />
      <button
        onClick={() => onChange(Math.min(99, value + 1))}
        className="grid size-9 place-items-center rounded-xl bg-surface-3 text-muted transition-colors hover:text-fg active:scale-95"
        aria-label="Increase"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ScoreRow({
  side,
  club,
  names,
  score,
  onScore,
  delta,
  eloByName,
}: {
  side: Side;
  club: string;
  names: string[];
  score: number;
  onScore: (v: number) => void;
  delta: number | null;
  eloByName: Map<string, number>;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {club ? (
          <ClubCrest name={club} size="lg" />
        ) : (
          <span
            className="grid h-[50px] w-[44px] place-items-center rounded-xl border border-dashed text-xs font-bold"
            style={{ borderColor: sideColor(side), color: sideColor(side) }}
          >
            {side}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{club || `Side ${side} club`}</p>
          <p className="truncate text-xs text-muted">{names.length ? names.map(displayName).join(" & ") : "No players yet"}</p>
          {delta !== null && names.length > 0 && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-faint">
              {names.map((n) => {
                const before = eloByName.get(cleanName(n)) ?? INITIAL_ELO;
                return (
                  <span key={n} className="tabular">
                    {before}→<span className="text-fg">{Math.round(before + delta)}</span>
                  </span>
                );
              })}
              <Delta value={delta} />
            </p>
          )}
        </div>
      </div>
      <Stepper value={score} onChange={onScore} side={side} />
    </div>
  );
}

/* ---------------------------------- Page ----------------------------------- */

function MatchCenterInner({ data }: { data: Analytics }) {
  // drafts are per board: names can repeat across boards
  const { slug } = useBoard();
  const allNames = useMemo(() => data.ranking.map((p) => p.name), [data.ranking]);
  const [absent, setAbsent] = useSessionState<string[]>(`${slug}:mc-absent`, []);
  const [mode, setMode] = useSessionState<TeamMode>(`${slug}:mc-mode`, "2v2");
  const [balance, setBalance] = useSessionState(`${slug}:mc-balance`, true);
  const [teamARaw, setTeamA] = useSessionState<string[]>(`${slug}:mc-team-a`, []);
  const [teamBRaw, setTeamB] = useSessionState<string[]>(`${slug}:mc-team-b`, []);
  const [clubA, setClubA] = useSessionState<ClubChoice>(`${slug}:mc-club-a`, null);
  const [clubB, setClubB] = useSessionState<ClubChoice>(`${slug}:mc-club-b`, null);
  const [margin, setMargin] = useSessionState(`${slug}:mc-margin`, 75);
  const [scoreA, setScoreA] = useSessionState(`${slug}:mc-score-a`, 0);
  const [scoreB, setScoreB] = useSessionState(`${slug}:mc-score-b`, 0);
  const [clubHint, setClubHint] = useState<string | null>(null);
  const addMatch = useAddMatch();

  const teamA = teamARaw.filter((n) => allNames.includes(n));
  const teamB = teamBRaw.filter((n) => allNames.includes(n));
  const present = allNames.filter((n) => !absent.includes(n));
  const sideOf = (n: string): Side | null => (teamA.includes(n) ? "A" : teamB.includes(n) ? "B" : null);

  const clubAName = choiceName(clubA, data.clubs);
  const clubBName = choiceName(clubB, data.clubs);
  const preview = previewMatch(data.engine, {
    teamA,
    teamB,
    clubA: clubAName || undefined,
    clubB: clubBName || undefined,
    scoreA,
    scoreB,
  });
  const recent = useMemo(() => lastTeammates(data.parsed), [data.parsed]);
  const tonightKey = matchdayKey(new Date());
  const tonight = data.parsed.filter((m) => m.matchday === tonightKey);

  const assign = (n: string, s: Side) => {
    const [mine, setMine, setOther] = s === "A" ? [teamA, setTeamA, setTeamB] : [teamB, setTeamB, setTeamA];
    setMine(mine.includes(n) ? mine.filter((x) => x !== n) : [...mine, n]);
    setOther((o) => o.filter((x) => x !== n));
  };
  const togglePresent = (n: string) => {
    setAbsent((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
    setTeamA((t) => t.filter((x) => x !== n));
    setTeamB((t) => t.filter((x) => x !== n));
  };

  const shuffle = () => {
    const r = generateTeams({ pool: present, mode, balance, eloByName: data.eloByName, recentPartners: recent });
    if (!r.ok) {
      toast.error("Couldn't draft teams", { description: r.reason });
      return;
    }
    setTeamA(r.teamA);
    setTeamB(r.teamB);
    toast(balance ? `Balanced draft · ${Math.round(r.diff)} Elo apart` : "Teams drafted", {
      description: "Last match's partners were split up.",
      icon: <Shuffle className="size-4" />,
    });
  };

  const pickClubs = () => {
    const pick = pickBalancedClubs(
      data.clubs,
      teamAverage(teamA, data.eloByName),
      teamAverage(teamB, data.eloByName),
      margin,
      clubA?.kind === "club" && clubB?.kind === "club" ? { a: clubA.id, b: clubB.id } : undefined,
    );
    if (!pick) return;
    setClubA({ kind: "club", id: pick.a.id });
    setClubB({ kind: "club", id: pick.b.id });
    setClubHint(
      pick.withinMargin
        ? `${pick.candidates} fair pairings within ±${margin} · this one is ${Math.round(pick.diff)} apart`
        : `Nothing within ±${margin} — closest pairing is ${Math.round(pick.diff)} apart`,
    );
  };

  const swap = () => {
    setTeamA(teamB);
    setTeamB(teamA);
    setClubA(clubB);
    setClubB(clubA);
    setScoreA(scoreB);
    setScoreB(scoreA);
  };

  const reset = () => {
    setTeamA([]);
    setTeamB([]);
    setClubA(null);
    setClubB(null);
    setScoreA(0);
    setScoreB(0);
    setClubHint(null);
  };

  const problem = !teamA.length || !teamB.length
    ? "Both sides need at least one player"
    : !clubAName || !clubBName
      ? "Pick a club for each side"
      : null;

  const submit = async () => {
    if (problem) return;
    const result: Side | "D" = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "D";
    try {
      await addMatch.mutateAsync({ clubA: clubAName, clubB: clubBName, teamA, teamB, scoreA, scoreB });
      burst(result);
      const winners = result === "A" ? teamA : result === "B" ? teamB : null;
      const d = result === "A" ? preview.deltaA : result === "B" ? preview.deltaB : preview.deltaA;
      toast.success(
        winners ? `${winners.map(displayName).join(" & ")} win ${Math.max(scoreA, scoreB)}–${Math.min(scoreA, scoreB)}` : `Draw ${scoreA}–${scoreB}`,
        { description: d !== null ? `Elo swing: ${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))} per player` : undefined },
      );
      setScoreA(0);
      setScoreB(0);
    } catch (e) {
      toast.error("Couldn't save the result", { description: (e as Error).message });
    }
  };

  const filledSteps = [teamA.length && teamB.length, clubAName && clubBName].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        eyebrow="Match center"
        title="Kick-off"
        description="Draft fair teams, pick balanced clubs and log the result. Elo updates the moment you hit save."
        actions={
          <>
            <Button variant="ghost" onClick={swap}>
              <ArrowLeftRight className="size-4" /> Swap sides
            </Button>
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="size-4" /> Reset
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="min-w-0 space-y-6 xl:col-span-7 2xl:col-span-8">
          <LayoutGroup>
            {/* Step 1 — squad */}
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <StepDot n={1} done={teamA.length > 0 && teamB.length > 0} /> Squad & teams
                </span>
              }
              subtitle={`${present.length} of ${allNames.length} players here · tap a name to mark absent`}
              action={<AddPlayer players={data.players} />}
            >
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <Segmented<TeamMode>
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "1v1", label: "1 v 1" },
                    { value: "2v2", label: "2 v 2" },
                    { value: "1v2", label: "1 v 2" },
                  ]}
                />
                <Switch
                  checked={balance}
                  onChange={setBalance}
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <Scale className="size-3.5" /> Balance by Elo
                    </span>
                  }
                />
                <Button variant="primary" className="ml-auto" onClick={shuffle}>
                  <Dices className="size-4" /> Shuffle teams
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {allNames.map((n) => (
                  <PoolChip
                    key={n}
                    name={n}
                    elo={data.eloByName.get(cleanName(n)) ?? INITIAL_ELO}
                    present={!absent.includes(n)}
                    side={sideOf(n)}
                    onTogglePresent={() => togglePresent(n)}
                    onAssign={(s) => assign(n, s)}
                  />
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <TeamPanel side="A" names={teamA} eloByName={data.eloByName} onRemove={(n) => assign(n, "A")} />
                <TeamPanel side="B" names={teamB} eloByName={data.eloByName} onRemove={(n) => assign(n, "B")} />
              </div>
              {teamA.length > 0 && teamB.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
                  <WinProbability pA={preview.expectedA} withClubs={!!(clubAName && clubBName)} />
                </motion.div>
              )}
            </Panel>
          </LayoutGroup>

          {/* Step 2 — clubs */}
          <Panel
            title={
              <span className="flex items-center gap-2">
                <StepDot n={2} done={!!(clubAName && clubBName)} /> Clubs
              </span>
            }
            subtitle="Balanced picks weigh squad Elo + half the club's rating"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <ClubPicker clubs={data.clubs} value={clubA} onChange={setClubA} side="A" placeholder="Side A club" />
              <ClubPicker clubs={data.clubs} value={clubB} onChange={setClubB} side="B" placeholder="Side B club" />
            </div>
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-line bg-surface-2/50 p-4 sm:flex-row sm:items-center">
              <div className="flex-1">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-muted">Fairness margin</span>
                  <span className="tabular font-semibold">±{margin}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={300}
                  step={5}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="range"
                  style={{ ["--fill" as string]: `${(margin / 300) * 100}%` }}
                />
              </div>
              <Button variant="secondary" onClick={pickClubs}>
                <Sparkles className="size-4 text-accent-text" /> Balanced random clubs
              </Button>
            </div>
            <AnimatePresence>
              {clubHint && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 text-xs text-muted"
                >
                  {clubHint}
                </motion.p>
              )}
            </AnimatePresence>
          </Panel>
        </div>

        {/* Step 3 — scoreboard */}
        <div className="min-w-0 xl:col-span-5 2xl:col-span-4">
          <div className="space-y-6 xl:sticky xl:top-24">
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <span className="flex items-center gap-2 text-[15px] font-semibold">
                  <StepDot n={3} done={false} /> Full time
                </span>
                <Pill tone={filledSteps === 2 ? "accent" : "neutral"}>{filledSteps}/2 ready</Pill>
              </div>
              <div className="space-y-4 p-5">
                <ScoreRow
                  side="A"
                  club={clubAName}
                  names={teamA}
                  score={scoreA}
                  onScore={setScoreA}
                  delta={preview.deltaA}
                  eloByName={data.eloByName}
                />
                <div className="flex items-center gap-3">
                  <div className="hairline flex-1" />
                  <span className="label">vs</span>
                  <div className="hairline flex-1" />
                </div>
                <ScoreRow
                  side="B"
                  club={clubBName}
                  names={teamB}
                  score={scoreB}
                  onScore={setScoreB}
                  delta={preview.deltaB}
                  eloByName={data.eloByName}
                />
                {preview.deltaA !== null && preview.multiplier > 1.05 && (
                  <p className="text-center text-[11px] text-faint">
                    Margin & upset multiplier ×{preview.multiplier.toFixed(2)}
                  </p>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  className="mt-2 w-full"
                  disabled={!!problem}
                  loading={addMatch.isPending}
                  onClick={submit}
                >
                  <Trophy className="size-5" />
                  Save result {scoreA}–{scoreB}
                </Button>
                {problem && <p className="text-center text-xs text-muted">{problem}</p>}
              </div>
            </section>

            <Panel
              title="Tonight"
              subtitle={tonight.length ? `${tonight.length} matches logged this session` : "Session starts with the first result"}
              icon={<Users className="size-4" />}
            >
              {tonight.length ? (
                <div className="space-y-2">
                  {tonight.map((m) => (
                    <MatchCard key={m.id} match={m} elo={data.engine.perMatch.get(m.id)} className="shadow-none" />
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="py-6"
                  icon={<Trophy className="size-5" />}
                  title="No matches yet tonight"
                  description="Results you save here show up instantly across the app."
                />
              )}
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepDot({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 place-items-center rounded-full font-display text-sm font-bold",
        done ? "bg-accent text-accent-ink" : "bg-surface-3 text-muted ring-1 ring-line-strong",
      )}
    >
      {n}
    </span>
  );
}

export default function MatchCenter() {
  return <DataGate>{(data) => <MatchCenterInner data={data} />}</DataGate>;
}
