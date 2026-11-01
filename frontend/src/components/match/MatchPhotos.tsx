import { BarChart3, Camera, ChevronLeft, ChevronRight, ExternalLink, Flag, ImagePlus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAiPhotos } from "../../hooks/useAiPhotos";
import { useCanEdit } from "../../hooks/useBoard";
import { useDeletePhoto, usePhotoBlob, useUploadPhotos } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { useObjectUrl } from "../../hooks/useObjectUrl";
import { cn } from "../../lib/cn";
import { MAX_PHOTOS } from "../../lib/photos";
import type { ParsedMatch } from "../../lib/stats";
import { ReportForm } from "../moderation/Report";
import { reportMessages } from "../moderation/messages";
import { Modal } from "../ui/Dialog";
import { Button, Segmented, Skeleton } from "../ui/primitives";
import { AiConsent, AiNote } from "./AiConsent";
import { MatchStatsPanel } from "./MatchStats";
import { photoMessages } from "./messages";

const m = photoMessages;

/** Opens the phone's camera or gallery; several photos at once. */
function PickButton({
  onPick,
  disabled,
  className,
  children,
}: {
  onPick: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const ai = useAiPhotos();
  const [asking, setAsking] = useState(false);
  // the first time on a device, whether the AI may read them comes first; the picker opens from the answer
  const pick = () => (ai === null ? setAsking(true) : input.current?.click());
  return (
    <>
      <button type="button" disabled={disabled} onClick={pick} className={className}>
        {children}
      </button>
      <AiConsent
        open={asking}
        onClose={() => setAsking(false)}
        onAnswer={() => {
          setAsking(false);
          input.current?.click();
        }}
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) onPick(files);
        }}
      />
    </>
  );
}

function Thumb({ id, onClick, active }: { id: number; onClick: () => void; active?: boolean }) {
  const { data, isError } = usePhotoBlob(id, "thumb");
  const url = useObjectUrl(data);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line transition hover:ring-line-strong",
        active && "ring-2 ring-accent",
      )}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-cover" draggable={false} />
      ) : isError ? (
        <Camera className="size-5 text-faint" />
      ) : (
        <Skeleton className="size-full rounded-none" />
      )}
    </button>
  );
}

/** One photo at full size, with the way back to the grid, its neighbours, deleting and reporting it. */
function Viewer({
  ids,
  index,
  onIndex,
  onBack,
}: {
  ids: number[];
  index: number;
  onIndex: (i: number) => void;
  onBack: () => void;
}) {
  const t = useT(m);
  const tr = useT(reportMessages);
  const id = ids[index];
  const { data, isError } = usePhotoBlob(id, "full");
  const url = useObjectUrl(data);
  const del = useDeletePhoto();
  const canEdit = useCanEdit();
  const [armed, setArmed] = useState(false);
  const [reporting, setReporting] = useState(false);
  useEffect(() => {
    setArmed(false);
    setReporting(false);
  }, [id]);

  const remove = async () => {
    if (!armed) return setArmed(true);
    try {
      await del.mutateAsync(id);
      toast.success(t("removed"));
      if (ids.length <= 1) onBack();
      else onIndex(Math.min(index, ids.length - 2));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative grid min-h-48 place-items-center overflow-hidden rounded-xl bg-black/90">
        {url ? (
          <img src={url} alt="" className="max-h-[62vh] w-full object-contain" />
        ) : isError ? (
          <Camera className="size-6 text-white/50" />
        ) : (
          <Skeleton className="h-64 w-full rounded-none" />
        )}
        {ids.length > 1 && (
          <>
            <button
              type="button"
              aria-label={t("prev")}
              onClick={() => onIndex((index - 1 + ids.length) % ids.length)}
              className="absolute top-1/2 left-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t("next")}
              onClick={() => onIndex((index + 1) % ids.length)}
              className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white hover:bg-black/75"
            >
              <ChevronRight className="size-5" />
            </button>
            <span className="tabular absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
              {index + 1}/{ids.length}
            </span>
          </>
        )}
      </div>
      {reporting ? (
        <div className="rounded-xl border border-line p-4">
          <ReportForm kind="photo" targetId={id} title={tr("photoTitle")} onDone={() => setReporting(false)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ChevronLeft className="size-4" /> {t("back")}
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>
            <Flag className="size-3.5" /> {tr("report")}
          </Button>
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg">
              <ExternalLink className="size-3.5" /> {t("original")}
            </a>
          )}
          {canEdit && (
            <Button variant={armed ? "danger" : "ghost"} size="sm" loading={del.isPending} onClick={remove}>
              <Trash2 className="size-3.5" /> {armed ? t("removeSure") : t("remove")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** Everything about a match's photos: the grid, one at full size, adding and deleting. */
type Tab = "stats" | "photos";

/** A match's stats and photos: the stats side by side, the photo grid, one photo at full size. */
function MatchDialog({ match, open, onClose, tab, onTab }: { match: ParsedMatch; open: boolean; onClose: () => void; tab: Tab; onTab: (t: Tab) => void }) {
  const t = useT(m);
  const [index, setIndex] = useState<number | null>(null);
  const { upload, progress } = useUploadPhotos();
  const canEdit = useCanEdit();
  const ids = match.photos;
  const room = MAX_PHOTOS - ids.length;

  const add = async (files: File[]) => {
    if (files.length > room) toast.error(t("full", { n: MAX_PHOTOS }));
    const picked = files.slice(0, room);
    if (!picked.length) return;
    const { stored, error } = await upload(match.id, picked);
    if (stored) toast.success(t("stored", { n: stored }));
    if (error) toast.error(t("failed"), { description: error.message });
  };

  const showPhoto = (photoId: number) => {
    const i = ids.indexOf(photoId);
    setIndex(i >= 0 ? i : null);
    onTab("photos");
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="match-dialog-title" wide>
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 id="match-dialog-title" className="font-semibold">
            {t("detail")}
          </h3>
          <p className="truncate text-sm text-muted">
            {match.clubA} <span className="tabular font-semibold text-fg">{match.scoreA}–{match.scoreB}</span> {match.clubB}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("close")}>
          <X className="size-4" />
        </Button>
      </div>
      <Segmented<Tab>
        value={tab}
        onChange={onTab}
        size="sm"
        className="mb-4"
        options={[
          {
            value: "stats",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 className="size-3.5" /> {t("tabStats")}
              </span>
            ),
          },
          {
            value: "photos",
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Camera className="size-3.5" /> {t("tabPhotos")}
                {ids.length > 0 && <span className="tabular text-faint">{ids.length}</span>}
              </span>
            ),
          },
        ]}
      />

      {tab === "stats" ? (
        <MatchStatsPanel match={match} onShowPhoto={showPhoto} />
      ) : index !== null && ids[index] !== undefined ? (
        <Viewer ids={ids} index={index} onIndex={setIndex} onBack={() => setIndex(null)} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {ids.map((id, i) => (
              <Thumb key={id} id={id} onClick={() => setIndex(i)} />
            ))}
            {canEdit && room > 0 && (
              <PickButton
                onPick={add}
                disabled={!!progress}
                className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line-strong text-muted transition hover:border-accent/60 hover:text-fg disabled:opacity-60"
              >
                <span className="flex flex-col items-center gap-1 px-2 text-center text-xs font-medium">
                  <ImagePlus className="size-5" />
                  {progress ? t("uploading", progress) : t("add")}
                </span>
              </PickButton>
            )}
          </div>
          {!ids.length && canEdit && <p className="mt-3 text-center text-xs text-muted">{t("noneHint")}</p>}
          {canEdit && <AiNote className="mt-3 text-center text-[11px] text-faint" />}
        </>
      )}
    </Modal>
  );
}

/**
 * The button on a match card for its stats and photos: shows how many photos it has and whether it
 * has stats. Without either it only shows where `canAdd` asks for it.
 */
export function MatchPhotosButton({ match, canAdd }: { match: ParsedMatch; canAdd?: boolean }) {
  const t = useT(m);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("stats");
  const n = match.photos.length;
  const hasStats = !!match.stats;
  if (!n && !hasStats && !canAdd) return null;
  const label = [hasStats && t("tabStats"), n && t("count", { n })].filter(Boolean).join(" · ") || t("add");
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // open on what there is: the stats, else the photos
          setTab(hasStats || !n ? "stats" : "photos");
          setOpen(true);
        }}
        title={label}
        aria-label={`${t("detail")} (${label})`}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-semibold transition-colors",
          n || hasStats ? "bg-surface-2 text-muted ring-1 ring-line hover:text-fg" : "text-faint hover:bg-surface-2 hover:text-muted",
        )}
      >
        {hasStats && <BarChart3 className={cn("size-3.5", "text-accent-text")} />}
        {n > 0 && (
          <>
            <Camera className="size-3.5" />
            <span className="tabular">{n}</span>
          </>
        )}
        {!n && !hasStats && (
          <>
            <ImagePlus className="size-3.5" />
            <span className="max-sm:hidden">{t("addShort")}</span>
          </>
        )}
      </button>
      <MatchDialog match={match} open={open} onClose={() => setOpen(false)} tab={tab} onTab={setTab} />
    </>
  );
}

function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const t = useT(m);
  const url = useObjectUrl(file);
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
      {url && <img src={url} alt="" className="size-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("unpick")}
        className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

/** Photos chosen before the result is saved; the Match Center sends them once the match exists. */
export function PhotoPicker({ files, onChange, busy }: { files: File[]; onChange: (files: File[]) => void; busy?: string | null }) {
  const t = useT(m);
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <Camera className="size-4 text-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t("pickTitle")}</p>
          <p className="text-[11px] text-faint">{busy ?? t("pickHint")}</p>
        </div>
        {files.length < MAX_PHOTOS && (
          <PickButton
            onPick={(picked) => {
              if (files.length + picked.length > MAX_PHOTOS) toast.error(t("full", { n: MAX_PHOTOS }));
              onChange([...files, ...picked].slice(0, MAX_PHOTOS));
            }}
            disabled={!!busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 text-xs font-medium hover:border-line-strong hover:bg-surface-3 disabled:opacity-50"
          >
            <ImagePlus className="size-3.5" />
            <span className="max-sm:hidden">{t("add")}</span>
            <span className="sm:hidden">{t("addShort")}</span>
          </PickButton>
        )}
      </div>
      {files.length > 0 && <AiNote className="mt-2 text-[11px] text-faint" />}
      {files.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {files.map((f, i) => (
            <PendingThumb key={`${f.name}-${f.lastModified}-${i}`} file={f} onRemove={() => onChange(files.filter((_, j) => j !== i))} />
          ))}
        </div>
      )}
    </div>
  );
}
