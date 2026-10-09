import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Languages, LayoutGrid, Moon, Plus, Search, Sun } from "lucide-react";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useBoard, useSessions } from "../../hooks/useBoard";
import { useLang, useT } from "../../hooks/useI18n";
import { useTheme } from "../../hooks/useTheme";
import { defineMessages, LANGS } from "../../lib/i18n";
import { common } from "../../lib/messages";
import { displayName } from "../../lib/format";
import { Avatar } from "../ui/Identity";
import { NAV, navMessages } from "./nav";

const m = defineMessages({
  en: {
    label: "Command menu",
    placeholder: "Search players, pages and actions…",
    empty: "Nothing found.",
    quick: "Quick actions",
    newMatch: "Start a new match",
    lightMode: "Switch to light mode",
    darkMode: "Switch to dark mode",
    language: "Switch to {language}",
    pages: "Pages",
    boards: "Boards",
    switchTo: "Switch to {name}",
    players: "Players",
  },
  tr: {
    label: "Komut menüsü",
    placeholder: "Oyuncu, sayfa ya da işlem ara…",
    empty: "Sonuç yok.",
    quick: "Hızlı işlemler",
    newMatch: "Yeni maç başlat",
    lightMode: "Açık temaya geç",
    darkMode: "Koyu temaya geç",
    language: "{language} diline geç",
    pages: "Sayfalar",
    boards: "Board'lar",
    switchTo: "{name} board'una geç",
    players: "Oyuncular",
  },
});

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { data } = useAnalytics();
  const { theme, toggle } = useTheme();
  const { slug, path } = useBoard();
  const t = useT(m);
  const tc = useT(common);
  const tn = useT(navMessages);
  const { lang, setLang } = useLang();
  const otherLang = LANGS.find((l) => l.value !== lang)!;
  const sessions = useSessions();

  /** `to` is a path inside the board unless `absolute` */
  const go = (to: string, absolute = false) => {
    onOpenChange(false);
    navigate(absolute ? to : path(to));
  };

  const itemCls =
    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-fg aria-disabled:opacity-50";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label={t("label")}
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      contentClassName="card fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden p-0 shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-faint" />
        <Command.Input
          placeholder={t("placeholder")}
          className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-10 text-center text-sm text-muted">{t("empty")}</Command.Empty>

        <Command.Group heading={t("quick")}>
          <Command.Item className={itemCls} onSelect={() => go("/play")} value="new match log result play">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
              <Plus className="size-4" />
            </span>
            {t("newMatch")}
            <CornerDownLeft className="ml-auto size-3.5 text-faint" />
          </Command.Item>
          <Command.Item
            className={itemCls}
            onSelect={() => {
              toggle();
              onOpenChange(false);
            }}
            value="toggle theme dark light mode"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-surface-2 ring-1 ring-line">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </span>
            {theme === "dark" ? t("lightMode") : t("darkMode")}
          </Command.Item>
          <Command.Item
            className={itemCls}
            onSelect={() => {
              setLang(otherLang.value);
              onOpenChange(false);
            }}
            value="language dil türkçe english turkish ingilizce"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-surface-2 ring-1 ring-line">
              <Languages className="size-4" />
            </span>
            {t("language", { language: otherLang.label })}
          </Command.Item>
        </Command.Group>

        <Command.Group heading={t("pages")}>
          {NAV.map((n) => (
            <Command.Item key={n.to} className={itemCls} onSelect={() => go(n.to)} value={`${tn(n.key)} ${tn(`${n.key}Desc`)}`}>
              <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted ring-1 ring-line">
                <n.icon className="size-4" />
              </span>
              <span>{tn(n.key)}</span>
              <span className="ml-auto hidden truncate text-xs text-faint sm:block">{tn(`${n.key}Desc`)}</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading={t("boards")}>
          {sessions
            .filter((s) => s.slug !== slug)
            .map((s) => (
              <Command.Item
                key={s.slug}
                className={itemCls}
                onSelect={() => go(`/b/${s.slug}`, true)}
                value={`board switch ${s.name} ${s.slug}`}
              >
                <Avatar name={s.name} size="sm" className="rounded-lg" />
                {t("switchTo", { name: s.name })}
              </Command.Item>
            ))}
          <Command.Item className={itemCls} onSelect={() => go("/", true)} value="all boards join create board">
            <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted ring-1 ring-line">
              <LayoutGrid className="size-4" />
            </span>
            {tc("joinOrCreate")}
          </Command.Item>
        </Command.Group>

        {data && (
          <Command.Group heading={t("players")}>
            {data.ranking.map((p) => (
              <Command.Item
                key={p.id}
                className={itemCls}
                onSelect={() => go(`/players/${encodeURIComponent(p.name)}`)}
                value={`player ${p.name}`}
              >
                <Avatar name={p.name} size="sm" />
                <span>{displayName(p.name)}</span>
                <span className="ml-auto tabular text-xs text-muted">
                  #{p.rank} · {p.elo}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
