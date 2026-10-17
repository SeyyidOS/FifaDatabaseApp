import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, LayoutGrid, LogOut, Plus, Search } from "lucide-react";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useLeagues, usePending, useShowsAccount } from "../../hooks/useAccount";
import { AccountMenu } from "../account/AccountMenu";
import { useBoard } from "../../hooks/useBoard";
import { cn } from "../../lib/cn";
import { nameLang } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import { common } from "../../lib/messages";
import { removeSession } from "../../lib/session";
import { useT } from "../../hooks/useI18n";
import { Avatar } from "../ui/Identity";
import { Button } from "../ui/primitives";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { LanguageButton } from "./LanguageButton";
import { navGroup, navMessages, type NavItem } from "./nav";
import { ThemeButton } from "./ThemeButton";

const m = defineMessages({
  en: {
    offline: "Server offline",
    syncing: "Syncing…",
    live: "Live data",
    yourBoards: "Your boards",
    menu: "Menu",
    more: "More",
    footer: "{matches} matches · {players} players · K {k}",
    search: "Search players, pages…",
    newMatch: "New match",
    matchCenter: "Match center",
    league: "League",
  },
  tr: {
    offline: "Sunucuya ulaşılamıyor",
    syncing: "Eşitleniyor…",
    live: "Canlı veri",
    yourBoards: "Board'ların",
    menu: "Menü",
    more: "Daha fazla",
    footer: "{matches} maç · {players} oyuncu · K {k}",
    search: "Oyuncu, sayfa ara…",
    newMatch: "Yeni maç",
    matchCenter: "Maç merkezi",
    league: "Lig",
  },
});

function SyncStatus({ compact }: { compact?: boolean }) {
  const t = useT(m);
  const { error, data } = useAnalytics();
  const fetching = useIsFetching();
  const state = error ? "offline" : fetching ? "syncing" : data ? "live" : "syncing";
  const label = { offline: t("offline"), syncing: t("syncing"), live: t("live") }[state];
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" title={label}>
      <span
        className={cn(
          "size-2 rounded-full",
          state === "live" && "live-dot bg-win",
          state === "syncing" && "animate-pulse bg-draw",
          state === "offline" && "bg-loss",
        )}
      />
      {!compact && label}
    </span>
  );
}

/** Forget this board on this device and go back to the board list. */
function useSignOut() {
  const { slug } = useBoard();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return () => {
    removeSession(slug);
    qc.removeQueries({ queryKey: ["board", slug] });
    navigate("/");
  };
}

function BoardSwitcher() {
  const t = useT(m);
  const tc = useT(common);
  const { slug, name, role, viaAccount } = useBoard();
  const leagues = useLeagues();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const item = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-surface-3";
  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface/70 p-2.5 text-left transition-colors hover:border-line-strong"
      >
        <Avatar name={name} size="md" className="rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block truncate text-[11px] text-muted">
            {tc(role)} · {slug}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-faint" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="card absolute inset-x-0 top-full z-40 mt-2 p-1.5 shadow-2xl"
          >
            <p className="label px-2.5 pt-1.5 pb-1">{t("yourBoards")}</p>
            {leagues.map((s) => (
              <Link key={s.slug} to={`/b/${s.slug}`} className={item}>
                <Avatar name={s.name} size="sm" className="rounded-lg" />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                {s.slug === slug && <Check className="size-4 text-accent-text" />}
              </Link>
            ))}
            <div className="hairline my-1.5" />
            <Link to="/" className={item}>
              <LayoutGrid className="size-4 text-muted" /> {tc("joinOrCreate")}
            </Link>
            {!viaAccount && (
              <button onClick={signOut} className={cn(item, "text-loss")}>
                <LogOut className="size-4" /> {tc("signOutDevice")}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SideLink({ item, quiet }: { item: NavItem; quiet?: boolean }) {
  const tn = useT(navMessages);
  const { path, slug } = useBoard();
  // join requests waiting in Settings, where they are handled
  const pending = usePending(slug);
  const badge = item.group === "settings" ? pending : 0;
  return (
    <NavLink
      to={path(item.to)}
      end={item.to === ""}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
          quiet ? "py-2" : "py-2.5",
          isActive ? "text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-0 -z-10 rounded-xl bg-surface-2 ring-1 ring-line"
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            />
          )}
          {isActive && (
            <motion.span layoutId="nav-bar" className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent" />
          )}
          <item.icon className={cn("size-[18px]", isActive ? "text-accent-text" : quiet && "text-faint")} />
          {tn(item.key)}
          {badge > 0 && (
            <span className="tabular ml-auto rounded-md bg-team-b/15 px-1.5 py-0.5 text-[11px] font-bold text-team-b">{badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  const t = useT(m);
  const { data } = useAnalytics();
  const { path } = useBoard();
  const onPlay = useLocation().pathname === path("/play");
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg-elev/80 backdrop-blur-xl lg:flex">
      <Link to="/" className="px-5 pt-6 pb-6">
        <Logo />
      </Link>
      <div className="px-3 pb-4">
        <BoardSwitcher />
      </div>
      <div className="px-3 pb-5">
        <Link
          to={path("/play")}
          aria-current={onPlay ? "page" : undefined}
          className={cn(
            "accent-gem flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-transform active:scale-[0.98]",
            onPlay && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg-elev",
          )}
        >
          <Plus className="size-4" strokeWidth={2.6} />
          {t("newMatch")}
        </Link>
      </div>
      <nav aria-label={t("menu")} className="flex flex-1 flex-col gap-1 px-3">
        {navGroup("tab").map((n) => (
          <SideLink key={n.to} item={n} />
        ))}
        <p className="label px-3 pt-5 pb-1.5">{t("more")}</p>
        {navGroup("more").map((n) => (
          <SideLink key={n.to} item={n} quiet />
        ))}
        <div className="mt-auto pt-4">
          {navGroup("settings").map((n) => (
            <SideLink key={n.to} item={n} quiet />
          ))}
        </div>
      </nav>
      <div className="m-3 rounded-2xl border border-line bg-surface/70 p-4">
        <div className="flex items-center justify-between">
          <SyncStatus />
          <span className="flex items-center">
            <LanguageButton />
            <ThemeButton />
          </span>
        </div>
        {data && (
          <p className="mt-2 text-xs text-faint">
            {t("footer", { matches: data.parsed.length, players: data.ranking.length, k: data.k })}
          </p>
        )}
      </div>
    </aside>
  );
}

function TopBar({ onSearch }: { onSearch: () => void }) {
  const t = useT(m);
  const navigate = useNavigate();
  const { path } = useBoard();
  // signed in: the account menu has the way to your leagues, signing out, and on phones language and theme
  const showsAccount = useShowsAccount();

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link to="/" className="lg:hidden">
          <Logo compact />
        </Link>
        <button
          onClick={onSearch}
          className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-surface/60 px-3 text-sm text-faint transition-colors hover:border-line-strong hover:text-muted sm:max-w-md"
        >
          <Search className="size-4" />
          <span className="truncate">{t("search")}</span>
          <kbd className="ml-auto hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted sm:block">
            ⌘K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <span className="hidden md:block">
            <SyncStatus />
          </span>
          {!showsAccount && (
            <span className="flex items-center lg:hidden">
              <LanguageButton />
              <ThemeButton />
            </span>
          )}
          <span className="hidden sm:block lg:hidden">
            <Button variant="primary" onClick={() => navigate(path("/play"))}>
              <Plus className="size-4" strokeWidth={2.5} />
              {t("newMatch")}
            </Button>
          </span>
          {showsAccount && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}

/**
 * Phones: three tabs, the match center as the gem in the middle, and League for the rest of the league's
 * pages (players, clubs, compare, insights, settings) in a sheet above the bar.
 */
function BottomNav() {
  const t = useT(m);
  const tc = useT(common);
  const tn = useT(navMessages);
  const { path, name, slug, viaAccount } = useBoard();
  const showsAccount = useShowsAccount();
  const pending = usePending(slug);
  const signOut = useSignOut();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const [overview, standings, matches, ...restTabs] = navGroup("tab");
  const sheet = [...restTabs, ...navGroup("more"), ...navGroup("settings")];
  const onPlay = pathname === path("/play");
  // on one of the sheet's pages, League is the tab you are on
  const inSheet = sheet.some((n) => pathname === path(n.to) || pathname.startsWith(`${path(n.to)}/`));
  const tab = "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors";
  const cell = (n: NavItem) => (
    <NavLink
      key={n.to}
      to={path(n.to)}
      end={n.to === ""}
      className={({ isActive }) => cn(tab, isActive && !open ? "text-accent-text" : "text-faint hover:text-muted")}
    >
      <n.icon className="size-[22px]" strokeWidth={1.9} />
      {tn(`${n.key}Short`)}
    </NavLink>
  );
  const row = "flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-semibold hover:bg-surface-2";
  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[25] bg-black/60 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              id="league-sheet"
              role="dialog"
              aria-label={name}
              className="card fixed inset-x-2.5 bottom-[calc(0.75rem+env(safe-area-inset-bottom)+68px+0.625rem)] z-[26] mx-auto max-w-md rounded-[28px] p-2 pt-4 shadow-2xl lg:hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 14 }}
              transition={{ type: "spring", bounce: 0.12, duration: 0.35 }}
            >
              <p lang={nameLang(name)} className="label truncate px-3 pb-3">
                {name}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {sheet.map((n) => (
                  <NavLink
                    key={n.to}
                    to={path(n.to)}
                    className={({ isActive }) =>
                      cn(
                        "relative flex flex-col items-center gap-2 rounded-2xl border px-1 py-3.5 text-[13px] font-semibold transition-colors",
                        isActive ? "border-line-strong bg-surface-2 text-fg" : "border-line text-muted hover:text-fg",
                      )
                    }
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-surface-2">
                      <n.icon className="size-5" />
                    </span>
                    {tn(n.key)}
                    {n.group === "settings" && pending > 0 && (
                      <span className="tabular absolute top-2 right-2 rounded-md bg-team-b/15 px-1.5 py-0.5 text-[11px] font-bold text-team-b">
                        {pending}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
              {/* a board opened with its password, without an account: the way back to the board list and out */}
              {(!showsAccount || !viaAccount) && (
                <div className="mt-2 border-t border-line pt-1.5">
                  {!showsAccount && (
                    <Link to="/" className={row}>
                      <LayoutGrid className="size-4 text-muted" /> {tc("allBoards")}
                    </Link>
                  )}
                  {!viaAccount && (
                    <button onClick={signOut} className={cn(row, "text-loss")}>
                      <LogOut className="size-4" /> {tc("signOut")}
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <nav
        aria-label={t("menu")}
        className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 lg:hidden"
      >
        <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center rounded-3xl border border-line bg-bg-elev/80 shadow-[0_20px_40px_-16px_rgba(0,0,0,0.6)] backdrop-blur-xl backdrop-saturate-150">
          {cell(overview)}
          {cell(standings)}
          <Link
            to={path("/play")}
            aria-label={t("matchCenter")}
            aria-current={onPlay ? "page" : undefined}
            className={cn(
              "accent-gem mx-auto grid size-[52px] rotate-45 place-items-center rounded-2xl transition-transform active:scale-95",
              onPlay && "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg-elev",
            )}
          >
            <Plus className="size-6 -rotate-45" strokeWidth={2.6} />
          </Link>
          {cell(matches)}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="league-sheet"
            className={cn(tab, open || inSheet ? "text-accent-text" : "text-faint hover:text-muted")}
          >
            <span className="relative">
              <LayoutGrid className="size-[22px]" strokeWidth={1.9} />
              {pending > 0 && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-team-b ring-2 ring-bg-elev" />}
            </span>
            {t("league")}
          </button>
        </div>
      </nav>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh">
      <div className="app-ambient" />
      <Sidebar />
      <div className="lg:pl-64">
        <TopBar onSearch={() => setPalette(true)} />
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto max-w-[1400px] px-4 pt-6 pb-32 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16"
        >
          {children}
        </motion.main>
      </div>
      <BottomNav />
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="label mb-2 text-accent-text">{eyebrow}</p>}
        <h1 className="display text-4xl sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
