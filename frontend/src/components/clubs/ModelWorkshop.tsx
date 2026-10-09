import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useApplyModel, useCards } from "../../hooks/useData";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { DEFAULT_MODEL, SLOTS, STATS, sanitizeModel, type AltMode, type ClubModel, type SlotKey } from "../../lib/clubModel";
import { clubFinder, referenceSeason, runModel } from "../../lib/clubs";
import type { Season } from "../../lib/types";
import { ClubCrest } from "../ui/Identity";
import { Button, Delta, Panel, Segmented, Skeleton } from "../ui/primitives";
import { slotMessages, workshopMessages } from "./messages";

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular font-semibold">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range"
        style={{ ["--fill" as string]: `${((value - min) / (max - min)) * 100}%` }}
        aria-label={label}
      />
    </label>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-2/60 py-1 pr-1 pl-3">
      <span className="text-xs font-semibold">{label}</span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30"
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
          aria-label={`${label} −`}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="tabular w-4 text-center text-sm font-bold">{value}</span>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-fg disabled:opacity-30"
          onClick={() => onChange(value + 1)}
          disabled={value >= 3}
          aria-label={`${label} +`}
        >
          <Plus className="size-3.5" />
        </button>
      </span>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** Admins tune the card model on a draft season and apply the ratings it produces. */
export function ModelWorkshop({ season, seasons, game, onClose }: { season: Season; seasons: Season[]; game: string; onClose: () => void }) {
  const t = useT(workshopMessages);
  const ts = useT(slotMessages);
  const cards = useCards(game);
  const apply = useApplyModel();
  const reference = referenceSeason(seasons, season);
  const [model, setModel] = useState<ClubModel>(() => sanitizeModel(season.model, !!reference));
  const set = (change: (m: ClubModel) => void) =>
    setModel((prev) => {
      const next = structuredClone(prev);
      change(next);
      return sanitizeModel(next, !!reference);
    });

  const result = useMemo(() => (cards.data ? runModel(cards.data, model, reference) : null), [cards.data, model, reference]);
  const preview = useMemo(() => {
    if (!result) return [];
    const find = clubFinder(season.clubs);
    return result.rows.map((r) => {
      const now = find(r.club);
      const next = Math.round(r.elo) + (now?.adjust ?? 0);
      return { r, now: now?.elo ?? null, next };
    });
  }, [result, season.clubs]);
  const changed = preview.filter((p) => p.now !== p.next);
  const biggest = changed.reduce((best, p) => Math.max(best, Math.abs(p.next - (p.now ?? p.next))), 0);

  const submit = () =>
    result &&
    apply.mutate(
      {
        season: season.id,
        game,
        model,
        clubs: result.rows.map((r) => ({ eaId: r.club.eaId, name: r.club.name, modelElo: Math.round(r.elo) })),
      },
      {
        onSuccess: () => {
          toast.success(t("applied", { season: season.name }), { description: t("appliedHint") });
          onClose();
        },
        onError: (e) => toast.error(t("failed"), { description: (e as Error).message }),
      },
    );

  return (
    <Panel
      title={t("title", { season: season.name })}
      subtitle={t("subtitle", { season: season.name })}
      icon={<FlaskConical className="size-4" />}
      action={
        <Button size="icon" variant="ghost" onClick={onClose} aria-label={t("close")}>
          <X className="size-4" />
        </Button>
      }
      className="ring-1 ring-accent/30"
    >
      {!result ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{cards.error ? cards.error.message : t("loading", { game })}</p>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <div className="grid content-start gap-8 sm:grid-cols-2">
            <Group title={t("positions")} hint={t("positionsHint")}>
              {SLOTS.map((s) => (
                <Slider
                  key={s.key}
                  label={ts(`${s.key}n`)}
                  value={model.posW[s.key]}
                  min={0}
                  max={3}
                  step={0.1}
                  format={(v) => `×${v.toFixed(1)}`}
                  onChange={(v) => set((m) => (m.posW[s.key] = v))}
                />
              ))}
            </Group>
            <div className="space-y-8">
              <Group title={t("benchTitle")} hint={t("benchHint")}>
                <div className="grid grid-cols-2 gap-2">
                  {SLOTS.map((s) => (
                    <Stepper
                      key={s.key}
                      label={ts(s.key as SlotKey)}
                      value={model.bench[s.key]}
                      onChange={(v) => set((m) => (m.bench[s.key] = v))}
                    />
                  ))}
                </div>
                <Slider
                  label={t("benchWeight")}
                  value={model.benchW}
                  min={0}
                  max={2}
                  step={0.05}
                  format={(v) => `×${v.toFixed(2)}`}
                  onChange={(v) => set((m) => (m.benchW = v))}
                />
              </Group>
              <Group title={t("altTitle")}>
                <Segmented<AltMode>
                  size="sm"
                  value={model.altMode}
                  onChange={(v) => set((m) => (m.altMode = v))}
                  options={[
                    { value: "free", label: t("altFree") },
                    { value: "gaps", label: t("altGaps") },
                    { value: "off", label: t("altOff") },
                  ]}
                />
                <Slider label={t("altPenalty")} value={model.altPenalty} min={0} max={10} step={0.5} onChange={(v) => set((m) => (m.altPenalty = v))} />
                <Slider label={t("missingPenalty")} value={model.missingPenalty} min={0} max={200} step={5} onChange={(v) => set((m) => (m.missingPenalty = v))} />
              </Group>
            </div>
            <Group title={t("scoreTitle")} hint={t("scoreHint")}>
              {STATS.map((k) => (
                <Slider
                  key={k}
                  label={k}
                  value={model.statW[k]}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) => set((m) => (m.statW[k] = v))}
                />
              ))}
            </Group>
            <Group title={t("scaleTitle")} hint={reference ? undefined : t("scaleNoRef")}>
              <Segmented<"fit" | "fixed">
                size="sm"
                value={model.scale.mode}
                onChange={(v) => set((m) => (m.scale.mode = v))}
                options={[
                  ...(reference ? [{ value: "fit" as const, label: t("scaleFit", { season: reference.name }) }] : []),
                  { value: "fixed", label: t("scaleFixed") },
                ]}
              />
              {model.scale.mode === "fixed" ? (
                <>
                  <Slider label={t("base")} value={model.scale.base} min={0} max={3000} step={25} onChange={(v) => set((m) => (m.scale.base = v))} />
                  <Slider label={t("k")} value={model.scale.k} min={5} max={200} step={5} onChange={(v) => set((m) => (m.scale.k = v))} />
                  <Slider label={t("anchor")} value={model.scale.anchor} min={60} max={95} step={1} onChange={(v) => set((m) => (m.scale.anchor = v))} />
                </>
              ) : (
                <p className="tabular text-xs text-muted">
                  {t("fitInfo", { a: Math.round(result.a), b: result.b.toFixed(1), r2: (result.fit?.r2 ?? 0).toFixed(2) })}
                </p>
              )}
            </Group>
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{t("preview")}</h3>
              <span className="text-xs text-muted">
                {changed.length ? t("previewSub", { changed: changed.length, move: biggest }) : t("previewNone")}
              </span>
            </div>
            <div className="max-h-[34rem] overflow-y-auto rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] font-semibold tracking-wider text-faint uppercase">
                  <tr>
                    <th className="w-8 py-2 pl-3 text-left">#</th>
                    <th className="py-2 text-left" />
                    <th className="py-2 text-right">{t("now")}</th>
                    <th className="py-2 pr-3 text-right">{t("newRating")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/50">
                  {preview.map(({ r, now, next }) => (
                    <tr key={r.club.eaId}>
                      <td className="tabular py-1.5 pl-3 text-xs text-faint">{r.rank}</td>
                      <td className="py-1.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <ClubCrest name={r.club.name} size="xs" />
                          <span className="truncate">{r.club.name}</span>
                        </span>
                      </td>
                      <td className="tabular py-1.5 text-right text-muted">{now ?? "—"}</td>
                      <td className="py-1.5 pr-3 text-right">
                        <span className="tabular font-semibold">{next}</span>
                        {now != null && now !== next && <Delta value={next - now} className="ml-1.5 inline-flex w-10 justify-end" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setModel(sanitizeModel(DEFAULT_MODEL, !!reference))}>
                <RotateCcw className="size-4" /> {t("reset")}
              </Button>
              <Button variant="primary" onClick={submit} loading={apply.isPending} className={cn(!changed.length && "opacity-80")}>
                {t("apply", { season: season.name })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
