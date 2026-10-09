import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, FlaskConical, Pencil, Plus, Search, Shield, Trash2 } from "lucide-react";
import type { Analytics } from "../../hooks/analytics-context";
import {
  useAddClub,
  useApplyModel,
  useCards,
  useCreateSeason,
  useDeleteClub,
  useDeleteSeason,
  useUpdateClub,
  useUpdateSeason,
} from "../../hooks/useData";
import { useBoard } from "../../hooks/useBoard";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { DEFAULT_MODEL } from "../../lib/clubModel";
import { LATEST_GAME, runModel } from "../../lib/clubs";
import { clubStars, DEFAULT_CLUB_ELO } from "../../lib/elo";
import { defineMessages } from "../../lib/i18n";
import { common } from "../../lib/messages";
import type { Club, Season } from "../../lib/types";
import { ConfirmDialog, Modal } from "../ui/Dialog";
import { Field, TextInput } from "../ui/form";
import { ClubCrest, Stars } from "../ui/Identity";
import { Button, Panel, Pill } from "../ui/primitives";

const MIN_ELO = -1000;
const MAX_ELO = 3000;

const m = defineMessages({
  en: {
    title: "Clubs",
    subtitle: "Club ratings per season. Matches keep the ratings they were played with.",
    newSeason: "New season",
    active: "Active",
    activeHint: "New matches use these ratings",
    draft: "Not active",
    draftHint: "Not used until you make it active",
    summary: "{clubs} clubs · {matches} matches",
    makeActive: "Make active",
    deleteSeason: "Delete season",
    searchOrAdd: "Search, or type a new club…",
    elo: "Elo",
    add: "Add",
    addTitle: "Add {name} at this rating",
    noClubs: "No clubs in this season yet. Type a name and a rating above to add one.",
    noMatch: "No club matches “{q}”. Set a rating and add it.",
    history:
      "Every match stores the club ratings it was played with, so changing a rating, removing a club or switching seasons never changes past results or anyone's Elo.",
    eloOf: "{name} rating",
    rename: "Rename",
    renameName: "Rename {name}",
    newName: "New name",
    remove: "Remove {name}",
    added: "{name} added to {season}",
    addFailed: "Couldn't add the club",
    rated: "{name}: {from} → {to}",
    ratedActive: "Applies from the next match; past matches keep their ratings.",
    ratedDraft: "Used once {season} is active.",
    renamed: "Renamed to {name}",
    renamedHint: "Past matches keep the name they were played under.",
    updateFailed: "Couldn't update the club",
    removeTitle: "Remove {name} from {season}?",
    removeHint: "It leaves this season's list. Matches already played with it keep their rating.",
    removed: "{name} removed",
    removeFailed: "Couldn't remove the club",
    createTitle: "New season",
    createHint: "Prepare it on the side; nothing changes until you make it active.",
    seasonName: "Name",
    seasonPlaceholder: "FC27",
    startFrom: "Start from",
    fromCards: "{game} card model ({n} clubs)",
    cardsLoading: "Loading {game} cards…",
    tuneModel: "Card model",
    tuneModelTip: "Tune the card model and re-rate this season",
    cardsBadge: "{game} cards",
    adjustTip: "Model {model}, corrected {adjust}",
    copyOf: "A copy of {season} ({n} clubs)",
    empty: "An empty list",
    create: "Create",
    created: "{name} created",
    createdHint: "Edit its clubs, then make it active when you start playing it.",
    createFailed: "Couldn't create the season",
    activateTitle: "Make {name} the active season?",
    activateHint:
      "New matches will use its {n} clubs and their ratings. Matches played so far keep the ratings they were played with, so nobody's Elo changes.",
    activated: "{name} is now active",
    activateFailed: "Couldn't switch seasons",
    deleteTitle: "Delete {name}?",
    deleteHint: "Its {n} clubs go with it. No matches were played in it.",
    deleted: "{name} deleted",
    deleteFailed: "Couldn't delete the season",
  },
  tr: {
    title: "Kulüpler",
    subtitle: "Sezon sezon kulüp puanları. Maçlar, oynandıkları puanları saklar.",
    newSeason: "Yeni sezon",
    active: "Aktif",
    activeHint: "Yeni maçlar bu puanlarla oynanır",
    draft: "Aktif değil",
    draftHint: "Aktif yapılana kadar kullanılmaz",
    summary: "{clubs} kulüp · {matches} maç",
    makeActive: "Aktif yap",
    deleteSeason: "Sezonu sil",
    searchOrAdd: "Ara ya da yeni kulüp yaz…",
    elo: "Elo",
    add: "Ekle",
    addTitle: "{name} kulübünü bu puanla ekle",
    noClubs: "Bu sezonda henüz kulüp yok. Eklemek için yukarıya ad ve puan yaz.",
    noMatch: "“{q}” ile eşleşen kulüp yok. Puanını girip ekleyebilirsin.",
    history:
      "Her maç, oynandığı andaki kulüp puanlarını saklar. Bu yüzden puan değiştirmek, kulüp çıkarmak ya da sezon değiştirmek geçmiş sonuçları ve kimsenin Elo'sunu değiştirmez.",
    eloOf: "{name} puanı",
    rename: "Yeniden adlandır",
    renameName: "{name} kulübünü yeniden adlandır",
    newName: "Yeni ad",
    remove: "{name} kulübünü çıkar",
    added: "{name}, {season} listesine eklendi",
    addFailed: "Kulüp eklenemedi",
    rated: "{name}: {from} → {to}",
    ratedActive: "Bir sonraki maçtan itibaren geçerli; geçmiş maçlar kendi puanlarını korur.",
    ratedDraft: "{season} aktif olunca kullanılacak.",
    renamed: "Yeni adı: {name}",
    renamedHint: "Geçmiş maçlar oynandıkları adla kalır.",
    updateFailed: "Kulüp güncellenemedi",
    removeTitle: "{name}, {season} listesinden çıkarılsın mı?",
    removeHint: "Bu sezonun listesinden çıkar. Onunla oynanmış maçlar puanlarını korur.",
    removed: "{name} çıkarıldı",
    removeFailed: "Kulüp çıkarılamadı",
    createTitle: "Yeni sezon",
    createHint: "Kenarda hazırla; aktif yapana kadar hiçbir şey değişmez.",
    seasonName: "Ad",
    seasonPlaceholder: "FC27",
    startFrom: "Başlangıç",
    fromCards: "{game} kart modeli ({n} kulüp)",
    cardsLoading: "{game} kartları yükleniyor…",
    tuneModel: "Kart modeli",
    tuneModelTip: "Kart modelini ayarla ve bu sezonu yeniden puanla",
    cardsBadge: "{game} kartları",
    adjustTip: "Model {model}, düzeltme {adjust}",
    copyOf: "{season} kopyası ({n} kulüp)",
    empty: "Boş liste",
    create: "Oluştur",
    created: "{name} oluşturuldu",
    createdHint: "Kulüplerini düzenle, oynamaya başlayınca aktif yap.",
    createFailed: "Sezon oluşturulamadı",
    activateTitle: "{name} aktif sezon olsun mu?",
    activateHint:
      "Yeni maçlar onun {n} kulübünü ve puanlarını kullanacak. Şimdiye kadarki maçlar oynandıkları puanları korur, yani kimsenin Elo'su değişmez.",
    activated: "{name} artık aktif",
    activateFailed: "Sezon değiştirilemedi",
    deleteTitle: "{name} silinsin mi?",
    deleteHint: "{n} kulübü de silinir. Bu sezonda hiç maç oynanmadı.",
    deleted: "{name} silindi",
    deleteFailed: "Sezon silinemedi",
  },
});

const fail = (what: string) => (e: unknown) => toast.error(what, { description: (e as Error).message });

const validElo = (v: string) => /^-?\d+$/.test(v.trim()) && Number(v) >= MIN_ELO && Number(v) <= MAX_ELO;
/** digits with an optional leading minus (the card model rates the weakest clubs below zero) */
const eloInput = (v: string) => v.replace(/[^\d-]/g, "").replace(/(?!^)-/g, "").slice(0, 5);

/* ----------------------------------- Club ---------------------------------- */

function ClubRow({ club, season }: { club: Club; season: Season }) {
  const t = useT(m);
  const tc = useT(common);
  const update = useUpdateClub();
  const remove = useDeleteClub();
  const [elo, setElo] = useState(String(club.elo));
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(club.name);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setElo(String(club.elo)), [club.elo]);

  const saveElo = () => {
    if (!validElo(elo) || Number(elo) === club.elo) return setElo(String(club.elo));
    const to = Number(elo);
    update.mutate(
      { season: season.id, id: club.id, elo: to },
      {
        onSuccess: () =>
          toast.success(t("rated", { name: club.name, from: club.elo, to }), {
            description: season.active ? t("ratedActive") : t("ratedDraft", { season: season.name }),
          }),
        onError: (e) => {
          setElo(String(club.elo));
          fail(t("updateFailed"))(e);
        },
      },
    );
  };

  const rename = (e: FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === club.name) return setRenaming(false);
    update.mutate(
      { season: season.id, id: club.id, name: next },
      {
        onSuccess: (c) => {
          setRenaming(false);
          toast.success(t("renamed", { name: c.name }), { description: t("renamedHint") });
        },
        onError: fail(t("updateFailed")),
      },
    );
  };

  const changed = validElo(elo) && Number(elo) !== club.elo;

  return (
    <li className="group flex items-center gap-3 px-4 py-2 hover:bg-surface-2/40">
      <ClubCrest name={renaming ? name : club.name} size="sm" />
      {renaming ? (
        <form onSubmit={rename} className="flex min-w-0 flex-1 gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setName(club.name);
                setRenaming(false);
              }
            }}
            maxLength={100}
            className="input h-8 text-sm"
            aria-label={t("newName")}
          />
          <Button type="submit" size="sm" variant="primary" loading={update.isPending}>
            {tc("save")}
          </Button>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{club.name}</span>
          <span className="hidden sm:inline-flex">
            <Stars value={clubStars(validElo(elo) ? Number(elo) : club.elo)} />
          </span>
          {club.modelElo != null && club.adjust !== 0 && (
            <span
              className="tabular hidden text-[11px] font-semibold text-draw sm:inline"
              title={t("adjustTip", { model: club.modelElo, adjust: `${club.adjust > 0 ? "+" : ""}${club.adjust}` })}
            >
              {club.adjust > 0 ? "+" : ""}
              {club.adjust}
            </span>
          )}
          <input
            inputMode="numeric"
            value={elo}
            onChange={(e) => setElo(eloInput(e.target.value))}
            onBlur={saveElo}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setElo(String(club.elo));
                requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
              }
            }}
            aria-label={t("eloOf", { name: club.name })}
            className={cn(
              "input tabular h-8 w-[4.5rem] px-2 text-right font-semibold",
              changed && "border-accent/60",
              !validElo(elo) && "border-loss/60",
            )}
          />
          <span className="flex opacity-70 transition-opacity group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="max-sm:size-8"
              onClick={() => setRenaming(true)}
              aria-label={t("renameName", { name: club.name })}
              title={t("rename")}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-loss max-sm:size-8"
              onClick={() => setConfirm(true)}
              aria-label={t("remove", { name: club.name })}
              title={t("remove", { name: club.name })}
            >
              <Trash2 className="size-4" />
            </Button>
          </span>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        loading={remove.isPending}
        title={t("removeTitle", { name: club.name, season: season.name })}
        description={t("removeHint")}
        onConfirm={() =>
          remove.mutate(
            { season: season.id, id: club.id },
            {
              onSuccess: () => toast.success(t("removed", { name: club.name })),
              onError: fail(t("removeFailed")),
              onSettled: () => setConfirm(false),
            },
          )
        }
      />
    </li>
  );
}

/* ---------------------------------- Season --------------------------------- */

function NewSeason({
  open,
  onClose,
  seasons,
  from,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  seasons: Season[];
  from: Season | null;
  onCreated: (s: Season) => void;
}) {
  const t = useT(m);
  const tc = useT(common);
  const create = useCreateSeason();
  const applyModel = useApplyModel();
  const cards = useCards(open ? LATEST_GAME : null);
  const hasGame = seasons.some((s) => s.game === LATEST_GAME);
  const [name, setName] = useState("");
  // "cards": rate a fresh season with the newest game's card model; a season id: copy it; "": empty
  const [source, setSource] = useState<string>("");
  useEffect(() => {
    if (!open) return;
    const fresh = !hasGame && !seasons.some((s) => s.name.toLowerCase() === LATEST_GAME.toLowerCase());
    setName(fresh ? LATEST_GAME : "");
    setSource(fresh ? "cards" : from ? String(from.id) : "");
  }, [open, from, hasGame, seasons]);

  const taken = seasons.some((s) => s.name.toLowerCase() === name.trim().toLowerCase());
  const busy = create.isPending || applyModel.isPending;
  const done = (s: Season) => {
    toast.success(t("created", { name: s.name }), { description: t("createdHint") });
    onCreated(s);
    onClose();
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || taken || (source === "cards" && !cards.data)) return;
    try {
      if (source !== "cards") {
        done(await create.mutateAsync({ name: name.trim(), ...(source ? { copyFrom: Number(source) } : {}) }));
        return;
      }
      // scaled onto the newest season so far, like the study scaled FC27 onto FC26
      const result = runModel(cards.data!, DEFAULT_MODEL, seasons.at(-1) ?? null);
      const season = await create.mutateAsync({ name: name.trim() });
      done(
        await applyModel.mutateAsync({
          season: season.id,
          game: LATEST_GAME,
          model: result.model,
          clubs: result.rows.map((r) => ({ eaId: r.club.eaId, name: r.club.name, modelElo: Math.round(r.elo) })),
        }),
      );
    } catch (err) {
      fail(t("createFailed"))(err);
    }
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="new-season-title">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <h3 id="new-season-title" className="font-semibold">
            {t("createTitle")}
          </h3>
          <p className="mt-1 text-sm text-muted">{t("createHint")}</p>
        </div>
        <Field label={t("seasonName")}>
          <TextInput
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={t("seasonPlaceholder")}
          />
        </Field>
        <Field label={t("startFrom")}>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="input h-11">
            <option value="cards" disabled={!cards.data}>
              {cards.data ? t("fromCards", { game: LATEST_GAME, n: cards.data.clubs.length }) : t("cardsLoading", { game: LATEST_GAME })}
            </option>
            {[...seasons].reverse().map((s) => (
              <option key={s.id} value={s.id}>
                {t("copyOf", { season: s.name, n: s.clubs.length })}
              </option>
            ))}
            <option value="">{t("empty")}</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!name.trim() || taken || (source === "cards" && !cards.data)}>
            {t("create")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------- Panel --------------------------------- */

export function ClubsAdmin({ data }: { data: Analytics }) {
  const t = useT(m);
  const navigate = useNavigate();
  const { path } = useBoard();
  const [selected, setSelected] = useState<number | null>(null);
  const season = data.seasons.find((s) => s.id === selected) ?? data.season ?? data.seasons.at(-1) ?? null;
  const [query, setQuery] = useState("");
  const [elo, setElo] = useState(String(DEFAULT_CLUB_ELO));
  const [creating, setCreating] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const add = useAddClub();
  const updateSeason = useUpdateSeason();
  const deleteSeason = useDeleteSeason();

  const q = query.trim().toLowerCase();
  const clubs = useMemo(
    () => (season?.clubs ?? []).filter((c) => !q || c.name.toLowerCase().includes(q)),
    [season, q],
  );
  const exists = !!season?.clubs.some((c) => c.name.toLowerCase() === q);
  const canAdd = !!season && !!q && !exists && validElo(elo);

  const addClub = (e: FormEvent) => {
    e.preventDefault();
    if (!season || !canAdd) return;
    const name = query.trim();
    add.mutate(
      { season: season.id, name, elo: Number(elo) },
      {
        onSuccess: (c) => {
          toast.success(t("added", { name: c.name, season: season.name }));
          setQuery("");
        },
        onError: fail(t("addFailed")),
      },
    );
  };

  return (
    <Panel
      title={t("title")}
      subtitle={t("subtitle")}
      icon={<Shield className="size-4" />}
      action={
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> {t("newSeason")}
        </Button>
      }
      bodyClassName="p-0 pt-4"
    >
      {/* seasons, newest first */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 sm:px-5">
        {[...data.seasons].reverse().map((s) => {
          const on = s.id === season?.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              aria-pressed={on}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 font-display text-sm font-bold tracking-wide transition-colors",
                on ? "border-accent/60 bg-accent/10 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {s.active && <span className="size-1.5 rounded-full bg-win shadow-[0_0_8px_var(--win)]" />}
              {s.name}
            </button>
          );
        })}
      </div>

      {season && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line bg-surface-2/40 px-4 py-3 sm:px-5">
            <Pill tone={season.active ? "win" : "neutral"}>{season.active ? t("active") : t("draft")}</Pill>
            {season.game && <Pill tone="accent">{t("cardsBadge", { game: season.game })}</Pill>}
            <span className="text-xs text-muted">
              {season.active ? t("activeHint") : t("draftHint")} ·{" "}
              <span className="tabular">{t("summary", { clubs: season.clubs.length, matches: season.matches })}</span>
            </span>
            {!season.active && (
              <span className="ml-auto flex gap-1">
                {season.matches === 0 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-loss"
                    onClick={() => setDeleting(true)}
                    aria-label={t("deleteSeason")}
                    title={t("deleteSeason")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
                <Button size="sm" variant="secondary" title={t("tuneModelTip")} onClick={() => navigate(path(`/clubs?season=${season.id}&model=1`))}>
                  <FlaskConical className="size-3.5" /> {t("tuneModel")}
                </Button>
                <Button size="sm" variant="primary" onClick={() => setActivating(true)}>
                  <Check className="size-3.5" /> {t("makeActive")}
                </Button>
              </span>
            )}
          </div>

          <form onSubmit={addClub} className="flex gap-2 px-4 py-3 sm:px-5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchOrAdd")}
                maxLength={100}
                className="input pl-9"
                aria-label={t("searchOrAdd")}
              />
            </div>
            <input
              inputMode="numeric"
              value={elo}
              onChange={(e) => setElo(eloInput(e.target.value))}
              className={cn("input tabular w-[4.5rem] px-2 text-right", !validElo(elo) && "border-loss/60")}
              aria-label={t("elo")}
              placeholder={t("elo")}
            />
            <Button
              type="submit"
              variant={canAdd ? "primary" : "secondary"}
              disabled={!canAdd}
              loading={add.isPending}
              title={canAdd ? t("addTitle", { name: query.trim() }) : undefined}
            >
              {!add.isPending && <Plus className="size-4" />}
              <span className="max-sm:sr-only">{t("add")}</span>
            </Button>
          </form>

          <ul className="max-h-[30rem] divide-y divide-line/50 overflow-y-auto border-t border-line">
            {clubs.map((c) => (
              <ClubRow key={c.id} club={c} season={season} />
            ))}
            {!clubs.length && (
              <li className="px-5 py-8 text-center text-sm text-muted">
                {q ? t("noMatch", { q: query.trim() }) : t("noClubs")}
              </li>
            )}
          </ul>
          <p className="border-t border-line px-4 py-3 text-xs text-faint sm:px-5">{t("history")}</p>

          <ConfirmDialog
            open={activating}
            onClose={() => setActivating(false)}
            tone="accent"
            confirmLabel={t("makeActive")}
            loading={updateSeason.isPending}
            title={t("activateTitle", { name: season.name })}
            description={t("activateHint", { n: season.clubs.length })}
            onConfirm={() =>
              updateSeason.mutate(
                { id: season.id, active: true },
                {
                  onSuccess: (s) => toast.success(t("activated", { name: s.name })),
                  onError: fail(t("activateFailed")),
                  onSettled: () => setActivating(false),
                },
              )
            }
          />
          <ConfirmDialog
            open={deleting}
            onClose={() => setDeleting(false)}
            loading={deleteSeason.isPending}
            title={t("deleteTitle", { name: season.name })}
            description={t("deleteHint", { n: season.clubs.length })}
            onConfirm={() =>
              deleteSeason.mutate(season.id, {
                onSuccess: () => {
                  toast.success(t("deleted", { name: season.name }));
                  setSelected(null);
                },
                onError: fail(t("deleteFailed")),
                onSettled: () => setDeleting(false),
              })
            }
          />
        </>
      )}

      <NewSeason
        open={creating}
        onClose={() => setCreating(false)}
        seasons={data.seasons}
        from={season}
        onCreated={(s) => setSelected(s.id)}
      />
    </Panel>
  );
}
