import { Ellipsis, PencilLine, Play, Trophy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCancelLive } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { useMinutesSince } from "../../hooks/useMinutesSince";
import type { LiveMatch } from "../../lib/types";
import { Modal } from "../ui/Dialog";
import { liveMessages } from "./messages";
import { Avatar, ClubCrest } from "../ui/Identity";

export function LiveBadge({ startedAt }: { startedAt: string }) {
  const t = useT(liveMessages);
  const minutes = useMinutesSince(startedAt);
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-[0.14em] text-loss uppercase">
        <span className="size-2 animate-pulse rounded-full bg-loss shadow-[0_0_0_4px_color-mix(in_oklab,var(--loss)_20%,transparent)]" />
        {t("live")}
      </span>
      {minutes < 1 ? t("justStarted") : t("minutes", { n: minutes })}
    </span>
  );
}

/** The two sides of a match being played, one under the other: club, players. */
export function LiveSides({ match }: { match: LiveMatch }) {
  return (
    <div className="space-y-1.5">
      {(
        [
          [match.clubA, match.teamA, "ring-team-a"],
          [match.clubB, match.teamB, "ring-team-b"],
        ] as const
      ).map(([club, team, ring]) => (
        <div key={club + team.join()} className="flex min-w-0 items-center gap-2.5">
          <ClubCrest name={club} size="sm" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{club}</span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
            {team.map(displayName).join(" · ")}
            <span className="flex -space-x-1">
              {team.map((n) => (
                <Avatar key={n} name={n} size="xs" className={cn("ring-2", ring)} />
              ))}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function LiveCard({ match, onEnter, onChange }: { match: LiveMatch; onEnter: () => void; onChange: () => void }) {
  const t = useT(liveMessages);
  const cancel = useCancelLive();
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const close = () => {
    setOpen(false);
    setArmed(false);
  };
  const drop = async () => {
    if (!armed) return setArmed(true);
    try {
      await cancel.mutateAsync(match.id);
      toast(t("cancelled"));
      close();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const row = "flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2";
  return (
    <div className="rounded-2xl border border-loss/25 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--loss)_10%,transparent),transparent_60%)] p-3.5">
      <div className="flex items-center gap-2">
        <LiveBadge startedAt={match.startedAt} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("options")}
          className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Ellipsis className="size-4" />
        </button>
      </div>
      <div className="my-3">
        <LiveSides match={match} />
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="accent-gem flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-transform active:scale-[0.98]"
      >
        <Trophy className="size-4" /> {t("enter")}
      </button>
      <Modal open={open} onClose={close} labelledBy={`live-${match.id}`}>
        <div id={`live-${match.id}`} className="border-b border-line pb-4">
          <LiveBadge startedAt={match.startedAt} />
          <div className="mt-3">
            <LiveSides match={match} />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <button
            type="button"
            className={row}
            onClick={() => {
              close();
              onChange();
            }}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">
              <PencilLine className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold">{t("change")}</span>
              <span className="block text-xs text-muted">{t("changeHint")}</span>
            </span>
          </button>
          <button type="button" className={cn(row, "bg-loss/[0.07] text-loss")} disabled={cancel.isPending} onClick={drop}>
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-loss/15">
              <X className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-bold">{armed ? t("cancelSure") : t("cancel")}</span>
              <span className="block text-xs opacity-80">{t("cancelHint")}</span>
            </span>
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-faint">{t("forgotten")}</p>
      </Modal>
    </div>
  );
}

/**
 * The Match Center's "being played" panel: each match someone started, on whichever device, with a way to
 * enter its result here (onEnter) or to change it (onChange). Nothing shows while none is being played.
 */
export function LivePanel({
  live,
  onEnter,
  onChange,
}: {
  live: LiveMatch[];
  onEnter: (m: LiveMatch) => void;
  onChange: (m: LiveMatch) => void;
}) {
  const t = useT(liveMessages);
  if (!live.length) return null;
  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-loss/12 text-loss">
          <Play className="size-4 fill-current" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {t("title")} <span className="font-medium text-faint">· {live.length}</span>
          </p>
          <p className="text-xs text-muted">{t("sub")}</p>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {live.map((m) => (
          <LiveCard key={m.id} match={m} onEnter={() => onEnter(m)} onChange={() => onChange(m)} />
        ))}
      </div>
    </section>
  );
}
