import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Moon, Plus, Search, Sun } from "lucide-react";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useTheme } from "../../hooks/useTheme";
import { displayName } from "../../lib/format";
import { Avatar } from "../ui/Identity";
import { NAV } from "./nav";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { data } = useAnalytics();
  const { theme, toggle } = useTheme();

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const itemCls =
    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-fg aria-disabled:opacity-50";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      contentClassName="card fixed left-1/2 top-[12vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden p-0 shadow-2xl"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="size-4 text-faint" />
        <Command.Input
          placeholder="Search players, pages and actions…"
          className="h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <kbd className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
      </div>
      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-10 text-center text-sm text-muted">Nothing found.</Command.Empty>

        <Command.Group heading="Quick actions">
          <Command.Item className={itemCls} onSelect={() => go("/play")} value="new match log result play">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
              <Plus className="size-4" />
            </span>
            Start a new match
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
            Switch to {theme === "dark" ? "light" : "dark"} mode
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Pages">
          {NAV.map((n) => (
            <Command.Item key={n.to} className={itemCls} onSelect={() => go(n.to)} value={`${n.label} ${n.description}`}>
              <span className="grid size-7 place-items-center rounded-lg bg-surface-2 text-muted ring-1 ring-line">
                <n.icon className="size-4" />
              </span>
              <span>{n.label}</span>
              <span className="ml-auto hidden truncate text-xs text-faint sm:block">{n.description}</span>
            </Command.Item>
          ))}
        </Command.Group>

        {data && (
          <Command.Group heading="Players">
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
