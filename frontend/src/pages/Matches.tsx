import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CalendarDays, Search, Star, X, Zap } from "lucide-react";
import { DataGate } from "../components/DataGate";
import { PageHeader } from "../components/layout/AppShell";
import { MatchCard } from "../components/match/MatchCard";
import { Avatar } from "../components/ui/Identity";
import { Button, Delta, EmptyState, Pill, Segmented } from "../components/ui/primitives";
import type { Analytics } from "../hooks/analytics-context";
import { useSessionState } from "../hooks/useSessionState";
import { cn } from "../lib/cn";
import { dayFromKey, displayName, formatWeekday, relativeTime } from "../lib/format";
import { isUpset, nightSummary } from "../lib/insights";
import { groupMatchdays } from "../lib/stats";

type ResultFilter = "all" | "decisive" | "draws" | "upsets";

function MatchesInner({ data }: { data: Analytics }) {
  const [player, setPlayer] = useSessionState<string | null>("mh-player", null);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useSessionState("mh-from", "");
  const [result, setResult] = useSessionState<ResultFilter>("mh-result", "all");
  const [shown, setShown] = useState(6);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.parsed.filter((m) => {
      if (player && !m.teamA.includes(player) && !m.teamB.includes(player)) return false;
      if (q && !m.clubA.toLowerCase().includes(q) && !m.clubB.toLowerCase().includes(q)) return false;
      if (from && m.matchday < from) return false;
      if (result === "draws" && m.result !== "D") return false;
      if (result === "decisive" && m.result === "D") return false;
      if (result === "upsets" && !isUpset(m, data.engine.perMatch.get(m.id))) return false;
      return true;
    });
  }, [data, player, query, from, result]);

  const days = useMemo(() => groupMatchdays(filtered), [filtered]);
  const active = !!(player || query || from || result !== "all");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Match history"
        title="Matches"
        description={`${data.parsed.length} results across ${data.matchdays.length} matchdays. Elo swings shown next to each line-up.`}
      />

      <div className="card space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by club…" className="input pl-9" />
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" aria-label="From date" />
          <Segmented<ResultFilter>
            value={result}
            onChange={setResult}
            size="sm"
            options={[
              { value: "all", label: "All" },
              { value: "decisive", label: "Decisive" },
              { value: "draws", label: "Draws" },
              {
                value: "upsets",
                label: (
                  <span className="inline-flex items-center gap-1">
                    <Zap className="size-3" />
                    Upsets
                  </span>
                ),
              },
            ]}
          />
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPlayer(null);
                setQuery("");
                setFrom("");
                setResult("all");
              }}
            >
              <X className="size-3.5" /> Clear
            </Button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.ranking.map((p) => {
            const on = player === p.name;
            return (
              <button
                key={p.id}
                onClick={() => setPlayer(on ? null : p.name)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-xs font-medium transition-colors",
                  on ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
                )}
              >
                <Avatar name={p.name} size="xs" />
                {displayName(p.name)}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm text-muted">
        <span className="font-semibold text-fg">{filtered.length}</span> matches
        {player && (
          <>
            {" "}
            featuring <span className="font-semibold text-fg">{displayName(player)}</span>
          </>
        )}
      </p>

      {!days.length ? (
        <div className="card">
          <EmptyState icon={<CalendarDays className="size-5" />} title="No matches found" description="Loosen the filters to see more results." />
        </div>
      ) : (
        <div className="space-y-10">
          {days.slice(0, shown).map((day, di) => {
            const summary = nightSummary(day, data.engine);
            const mvp = summary[0];
            const d = dayFromKey(day.key);
            return (
              <motion.section
                key={day.key}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: di < 2 ? di * 0.05 : 0 }}
              >
                <div className="sticky top-16 z-10 -mx-4 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 bg-bg/80 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  <div>
                    <h2 className="display text-2xl">{formatWeekday(d)}</h2>
                    <p className="text-xs text-muted">
                      {relativeTime(day.matches[0].date)} · {day.matches.length} matches · {day.goals} goals
                    </p>
                  </div>
                  {mvp && !player && (
                    <Pill tone="accent" className="ml-auto py-1 pl-1">
                      <Avatar name={mvp.name} size="xs" />
                      <Star className="size-3" /> {displayName(mvp.name)}
                      <Delta value={mvp.delta} className="ml-0.5" />
                    </Pill>
                  )}
                </div>
                <div className="space-y-2">
                  {day.matches.map((m) => (
                    <MatchCard key={m.id} match={m} elo={data.engine.perMatch.get(m.id)} perspective={player ?? undefined} />
                  ))}
                </div>
              </motion.section>
            );
          })}
          {shown < days.length && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setShown((s) => s + 6)}>
                Load older matchdays ({days.length - shown} more)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Matches() {
  return <DataGate>{(data) => <MatchesInner data={data} />}</DataGate>;
}
