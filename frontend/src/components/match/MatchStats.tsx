import { BarChart3, Camera, PencilLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteStats, useSaveStats } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { betterSide, formatStat, STAT_DEFS, type StatDef } from "../../lib/matchStats";
import type { ParsedMatch } from "../../lib/stats";
import type { Side, SideStats } from "../../lib/types";
import { ClubCrest } from "../ui/Identity";
import { Button } from "../ui/primitives";
import { photoMessages, statMessages } from "./messages";

type Draft = Record<Side, Record<string, string>>;

const toDraft = (stats: ParsedMatch["stats"]): Draft => ({
  A: Object.fromEntries(Object.entries(stats?.A ?? {}).map(([k, v]) => [k, String(v)])),
  B: Object.fromEntries(Object.entries(stats?.B ?? {}).map(([k, v]) => [k, String(v)])),
});

/** Typed numbers back to stats; empty fields are left out ("12,5" is read as 12.5). */
function fromDraft(draft: Record<string, string>): SideStats {
  const out: Record<string, number> = {};
  for (const def of STAT_DEFS) {
    const raw = draft[def.key]?.trim().replace(",", ".");
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out[def.key] = def.kind === "xg" ? Math.round(n * 100) / 100 : Math.round(n);
  }
  return out;
}

function SideHead({ match, side }: { match: ParsedMatch; side: Side }) {
  const club = side === "A" ? match.clubA : match.clubB;
  const team = side === "A" ? match.teamA : match.teamB;
  return (
    <div className={cn("flex min-w-0 items-center gap-2", side === "B" && "flex-row-reverse text-right")}>
      <ClubCrest name={club} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{club}</p>
        <p className="truncate text-[11px] text-muted">{team.map(displayName).join(" & ")}</p>
      </div>
    </div>
  );
}

function StatRow({ def, a, b, label }: { def: StatDef; a?: number; b?: number; label: string }) {
  const best = betterSide(def, a, b);
  const total = (a ?? 0) + (b ?? 0);
  const share = def.kind === "pct" && def.key !== "possession" ? null : total ? (a ?? 0) / total : 0.5;
  return (
    <div className="py-1.5">
      <div className="grid grid-cols-[3.25rem_1fr_3.25rem] items-center gap-2 text-sm">
        <span className={cn("tabular", best === "A" ? "font-bold text-fg" : "text-muted")}>{formatStat(def.kind, a)}</span>
        <span className="truncate text-center text-xs text-muted">{label}</span>
        <span className={cn("tabular text-right", best === "B" ? "font-bold text-fg" : "text-muted")}>{formatStat(def.kind, b)}</span>
      </div>
      {share !== null ? (
        <div className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-full">
          <span className={cn("rounded-l-full bg-team-a", best === "B" && "opacity-40")} style={{ width: `${share * 100}%` }} />
          <span className={cn("flex-1 rounded-r-full bg-team-b", best === "A" && "opacity-40")} />
        </div>
      ) : (
        // rates: each side against its own 100%
        <div className="mt-1 grid grid-cols-2 gap-2">
          <span className="flex h-1 justify-end overflow-hidden rounded-full bg-surface-3">
            <span className={cn("rounded-full bg-team-a", best === "B" && "opacity-40")} style={{ width: `${a ?? 0}%` }} />
          </span>
          <span className="flex h-1 overflow-hidden rounded-full bg-surface-3">
            <span className={cn("rounded-full bg-team-b", best === "A" && "opacity-40")} style={{ width: `${b ?? 0}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}

/** A match's stats side by side, typed in or read from its photo, with editing. */
export function MatchStatsPanel({ match, onShowPhoto }: { match: ParsedMatch; onShowPhoto?: (photoId: number) => void }) {
  const t = useT(photoMessages);
  const ts = useT(statMessages);
  const save = useSaveStats();
  const del = useDeleteStats();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [armed, setArmed] = useState(false);
  const stats = match.stats;

  const submit = async () => {
    if (!draft) return;
    try {
      await save.mutateAsync({ matchId: match.id, A: fromDraft(draft.A), B: fromDraft(draft.B), photoId: stats?.photoId });
      toast.success(t("saved"));
      setDraft(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async () => {
    if (!armed) return setArmed(true);
    try {
      await del.mutateAsync(match.id);
      toast.success(t("statsRemoved"));
      setArmed(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const heads = (
    <div className="grid grid-cols-2 gap-3 border-b border-line pb-3">
      <SideHead match={match} side="A" />
      <SideHead match={match} side="B" />
    </div>
  );

  if (draft) {
    const input = (side: Side, def: StatDef) => (
      <input
        value={draft[side][def.key] ?? ""}
        onChange={(e) => setDraft({ ...draft, [side]: { ...draft[side], [def.key]: e.target.value } })}
        inputMode={def.kind === "xg" ? "decimal" : "numeric"}
        aria-label={`${ts(def.key)} · ${t("sideHint", { side })}`}
        className={cn("input tabular h-8 px-2 py-1 text-sm", side === "B" && "text-right")}
      />
    );
    return (
      <div>
        {heads}
        <div className="mt-2 space-y-1.5">
          {STAT_DEFS.map((def) => (
            <div key={def.key} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2">
              {input("A", def)}
              <span className="truncate text-center text-xs text-muted">{ts(def.key)}</span>
              {input("B", def)}
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
            {t("cancel")}
          </Button>
          <Button variant="primary" size="sm" loading={save.isPending} onClick={submit}>
            {t("save")}
          </Button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid place-items-center gap-2 py-8 text-center">
        <BarChart3 className="size-6 text-faint" />
        <p className="text-sm font-semibold">{t("noStats")}</p>
        <p className="max-w-sm text-xs text-muted">{t("noStatsHint")}</p>
        <Button variant="secondary" size="sm" className="mt-2" onClick={() => setDraft(toDraft(null))}>
          <PencilLine className="size-3.5" /> {t("enter")}
        </Button>
      </div>
    );
  }

  const shown = STAT_DEFS.filter((def) => stats.A[def.key] !== undefined || stats.B[def.key] !== undefined);
  return (
    <div>
      {heads}
      <div className="mt-1 divide-y divide-line/60">
        {shown.map((def) => (
          <StatRow key={def.key} def={def} a={stats.A[def.key]} b={stats.B[def.key]} label={ts(def.key)} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="text-[11px] text-faint">{stats.source === "ocr" ? t("fromPhoto") : t("byHand")}</span>
        {stats.photoId !== null && onShowPhoto && (
          <Button variant="ghost" size="sm" onClick={() => onShowPhoto(stats.photoId!)}>
            <Camera className="size-3.5" /> {t("showPhoto")}
          </Button>
        )}
        <span className="flex-1" />
        <Button variant={armed ? "danger" : "ghost"} size="sm" loading={del.isPending} onClick={remove}>
          <Trash2 className="size-3.5" /> {armed ? t("removeSure") : t("remove")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setDraft(toDraft(stats))}>
          <PencilLine className="size-3.5" /> {t("edit")}
        </Button>
      </div>
    </div>
  );
}
