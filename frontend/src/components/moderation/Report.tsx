import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { useBoard } from "../../hooks/useBoard";
import { useT } from "../../hooks/useI18n";
import { ApiError } from "../../lib/api";
import { cn } from "../../lib/cn";
import { common } from "../../lib/messages";
import type { ReportReason } from "../../lib/types";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/primitives";
import { reportMessages } from "./messages";

const REASONS: ReportReason[] = ["offensive", "harassment", "impersonation", "other"];

/** Why, and a note: the form of a report on a photo or a player (backend/moderation.py), for inside a dialog. */
export function ReportForm({
  kind,
  targetId,
  title,
  onDone,
}: {
  kind: "photo" | "player";
  targetId: number;
  title: string;
  /** after sending, or to go back without sending */
  onDone: () => void;
}) {
  const t = useT(reportMessages);
  const tc = useT(common);
  const { api } = useBoard();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.report({ kind, targetId, reason, note: note.trim() || undefined });
      toast.success(t("sent"));
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h3 id="report-title" className="flex items-center gap-2 font-semibold">
        <Flag className="size-4 text-loss" /> {title}
      </h3>
      <p className="mt-1.5 text-sm text-muted">{t("lead")}</p>
      <div className="mt-4 grid gap-2" role="radiogroup">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
              reason === r ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {t(r)}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder={t("note")}
        aria-label={t("note")}
        className="input mt-3 w-full resize-none"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button variant="primary" onClick={send} loading={busy} disabled={!reason}>
          {t("send")}
        </Button>
      </div>
    </div>
  );
}

/** A report in a dialog of its own (a player's page). */
export function ReportDialog({
  open,
  onClose,
  kind,
  targetId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  kind: "photo" | "player";
  targetId: number;
  title: string;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="report-title">
      {open && <ReportForm kind={kind} targetId={targetId} title={title} onDone={onClose} />}
    </Modal>
  );
}
