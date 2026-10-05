import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import { Menu, Moon, Plus, Search, Sun, X } from "lucide-react";
import { Toaster } from "sonner";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useTheme } from "../../hooks/useTheme";
import { cn } from "../../lib/cn";
import { Button } from "../ui/primitives";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { NAV } from "./nav";

function SyncStatus({ compact }: { compact?: boolean }) {
  const { error, data } = useAnalytics();
  const fetching = useIsFetching();
  const state = error ? "offline" : fetching ? "syncing" : data ? "live" : "syncing";
  const label = { offline: "Server offline", syncing: "Syncing…", live: "Live data" }[state];
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

function ThemeButton() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}

function Sidebar() {
  const { data } = useAnalytics();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-bg-elev/80 backdrop-blur-xl lg:flex">
      <div className="px-5 pt-6 pb-8">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        <p className="label px-3 pb-2">Menu</p>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
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
                  <motion.span
                    layoutId="nav-bar"
                    className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-accent"
                  />
                )}
                <n.icon className={cn("size-[18px]", isActive && "text-accent-text")} />
                {n.label}
                {n.to === "/play" && (
                  <span className="ml-auto rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                    PLAY
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="m-3 rounded-2xl border border-line bg-surface/70 p-4">
        <div className="flex items-center justify-between">
          <SyncStatus />
          <ThemeButton />
        </div>
        {data && (
          <p className="mt-2 text-xs text-faint">
            {data.parsed.length} matches · {data.players.length} players · K {data.k}
          </p>
        )}
      </div>
    </aside>
  );
}

function TopBar({ onSearch }: { onSearch: () => void }) {
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <span className="lg:hidden">
          <Logo compact />
        </span>
        <button
          onClick={onSearch}
          className="group flex h-10 min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-surface/60 px-3 text-sm text-faint transition-colors hover:border-line-strong hover:text-muted sm:max-w-md"
        >
          <Search className="size-4" />
          <span className="truncate">Search players, pages…</span>
          <kbd className="ml-auto hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted sm:block">
            ⌘K
          </kbd>
        </button>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
          <span className="hidden md:block">
            <SyncStatus />
          </span>
          <span className="lg:hidden">
            <ThemeButton />
          </span>
          <span className="hidden sm:block">
            <Button variant="primary" onClick={() => navigate("/play")}>
              <Plus className="size-4" strokeWidth={2.5} />
              New match
            </Button>
          </span>
          <span className="lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMenu((m) => !m)} aria-label="Menu">
              {menu ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </span>
        </div>
      </div>
      {menu && (
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2 border-t border-line px-4 py-4 lg:hidden"
        >
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium",
                  isActive ? "border-line-strong bg-surface-2 text-fg" : "border-line text-muted",
                )
              }
            >
              <n.icon className="size-4" />
              {n.label}
            </NavLink>
          ))}
        </motion.nav>
      )}
    </header>
  );
}

function BottomNav() {
  const items = NAV.filter((n) => ["/", "/leaderboard", "/matches", "/players"].includes(n.to));
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const cell = (n: (typeof NAV)[number]) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.to === "/"}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-semibold tracking-wide",
          isActive ? "text-fg" : "text-faint",
        )
      }
    >
      {({ isActive }) => (
        <>
          <n.icon className={cn("size-5", isActive && "text-accent-text")} />
          {n.short}
        </>
      )}
    </NavLink>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg-elev/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {items.slice(0, 2).map(cell)}
        <div className="flex flex-1 justify-center">
          <button
            onClick={() => navigate("/play")}
            aria-label="Match center"
            className={cn(
              "-mt-6 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-[0_10px_30px_-8px_var(--accent)] ring-4 ring-bg transition-transform active:scale-95",
              pathname === "/play" && "rotate-45",
            )}
          >
            <Plus className={cn("size-6 transition-transform", pathname === "/play" && "-rotate-45")} strokeWidth={2.5} />
          </button>
        </div>
        {items.slice(2).map(cell)}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const location = useLocation();
  const { theme } = useTheme();

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
          className="mx-auto max-w-[1400px] px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-16"
        >
          {children}
        </motion.main>
      </div>
      <BottomNav />
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <Toaster
        position="top-center"
        theme={theme}
        offset={20}
        toastOptions={{
          classNames: {
            toast: "!rounded-2xl !border !border-line !bg-surface !text-fg !shadow-2xl !font-sans",
            description: "!text-muted",
          },
        }}
      />
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
