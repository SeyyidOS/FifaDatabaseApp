import { Minus, PencilLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FIX_MINUTES, useBoard } from "../../hooks/useBoard";
import { useDeleteMatch, useFixScore } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { ApiError } from "../../lib/api";
import { displayName } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import { common } from "../../lib/messages";
import type { ParsedMatch } from "../../lib/stats";
import type { Side } from "../../lib/types";
import { Modal } from "../ui/Dialog";
import { ClubCrest } from "../ui/Identity";
import { Button } from "../ui/primitives";

const m = defineMessages({
  en: {
    fix: "Fix",
    title: "Fix this match",
    hint: "For {n} minutes after a match is logged, anyone in the league can fix its score or take it back.",
    hintAdmin: "As an admin you can change any match.",
    saved: "Score fixed",
    remove: "Delete match",
    removeSure: "Tap again to delete",
    removed: "Match deleted",
    tooLate: "{n} minutes have passed: now only the league's admins can change it.",
    less: "One less",
    more: "One more",
  },
  tr: {
    fix: "Düzelt",
    title: "Maçı düzelt",
    hint: "Bir maç girildikten sonraki {n} dakika boyunca ligdeki herkes skorunu düzeltebilir ya da maçı geri alabilir.",
    hintAdmin: "Yönetici olarak her maçı değiştirebilirsin.",
    saved: "Skor düzeltildi",
    remove: "Maçı sil",
    removeSure: "Silmek için tekrar dokun",
    removed: "Maç silindi",
    tooLate: "{n} dakika geçti: artık sadece ligin yöneticileri değiştirebilir.",
    less: "Bir eksik",
    more: "Bir fazla",
  },
});

function Stepper({ value, onChange, side }: { value: number; onChange: (v: number) => void; side: Side }) {
  const t = useT(m);
  const step = "grid size-11 place-items-center rounded-xl border border-line bg-surface-2 text-muted hover:text-fg disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={step} onClick={() => onChange(value - 1)} disabled={value <= 0} aria-label={`${t("less")} (${side})`}>
        <Minus className="size-4" />
      </button>
      <span className="display tabular w-12 text-center text-5xl">{value}</span>
      <button type="button" className={step} onClick={() => onChange(value + 1)} disabled={value >= 99} aria-label={`${t("more")} (${side})`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function SideRow({ club, team }: { club: string; team: string[] }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <ClubCrest name={club} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{club}</p>
        <p className="truncate text-xs text-muted">{team.map(displayName).join(" & ")}</p>
      </div>
    </div>
  );
}

/** The "Fix" button on a match card and its dialog: the score put right, or the match taken back. */
export function FixMatchButton({ match }: { match: ParsedMatch }) {
  const t = useT(m);
  const tc = useT(common);
  const { role } = useBoard();
  const fix = useFixScore();
  const del = useDeleteMatch();
  const [open, setOpen] = useState(false);
  const [scoreA, setScoreA] = useState(match.scoreA);
  const [scoreB, setScoreB] = useState(match.scoreB);
  const [armed, setArmed] = useState(false);

  const show = () => {
    setScoreA(match.scoreA);
    setScoreB(match.scoreB);
    setArmed(false);
    setOpen(true);
  };
  const failed = (e: unknown) =>
    toast.error(e instanceof ApiError && e.status === 403 ? t("tooLate", { n: FIX_MINUTES }) : (e as Error).message);
  const save = async () => {
    try {
      await fix.mutateAsync({ id: match.id, scoreA, scoreB });
      toast.success(t("saved"), { description: `${match.clubA} ${scoreA}–${scoreB} ${match.clubB}` });
      setOpen(false);
    } catch (e) {
      failed(e);
    }
  };
  const remove = async () => {
    if (!armed) return setArmed(true);
    try {
      await del.mutateAsync(match.id);
      toast.success(t("removed"));
      setOpen(false);
    } catch (e) {
      failed(e);
    }
  };
  const changed = scoreA !== match.scoreA || scoreB !== match.scoreB;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          show();
        }}
        className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold text-faint transition-colors hover:bg-surface-2 hover:text-muted"
      >
        <PencilLine className="size-3.5" /> {t("fix")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={`fix-${match.id}`}>
        <h3 id={`fix-${match.id}`} className="font-semibold">
          {t("title")}
        </h3>
        <p className="mt-1 text-sm text-muted">{role === "admin" ? t("hintAdmin") : t("hint", { n: FIX_MINUTES })}</p>
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <SideRow club={match.clubA} team={match.teamA} />
            <Stepper value={scoreA} onChange={setScoreA} side="A" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <SideRow club={match.clubB} team={match.teamB} />
            <Stepper value={scoreB} onChange={setScoreB} side="B" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant={armed ? "danger" : "ghost"} size="sm" loading={del.isPending} onClick={remove}>
            <Trash2 className="size-3.5" /> {armed ? t("removeSure") : t("remove")}
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {tc("cancel")}
          </Button>
          <Button variant="primary" size="sm" loading={fix.isPending} disabled={!changed} onClick={save}>
            {tc("save")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
