import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, PenLine, Search } from "lucide-react";
import { cn } from "../../lib/cn";
import { clubStars } from "../../lib/elo";
import { choiceName, type ClubChoice } from "../../lib/clubChoice";
import type { Club } from "../../lib/types";
import { ClubCrest, Stars } from "./Identity";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";

const m = defineMessages({
  en: {
    choose: "Choose club",
    elo: "{elo} Elo",
    custom: "Custom club",
    searchAll: "Search all clubs",
    searchPlaceholder: "Search or type a custom club…",
    useCustom: "Use custom club “{name}”",
    noMatch: "No clubs match.",
  },
  tr: {
    choose: "Kulüp seç",
    elo: "{elo} Elo",
    custom: "Özel kulüp",
    searchAll: "Tüm kulüplerde ara",
    searchPlaceholder: "Ara ya da özel bir kulüp yaz…",
    useCustom: "Özel kulüp kullan: “{name}”",
    noMatch: "Eşleşen kulüp yok.",
  },
});

export function ClubPicker({
  clubs,
  value,
  onChange,
  side,
  placeholder,
}: {
  clubs: Club[];
  value: ClubChoice;
  onChange: (c: ClubChoice) => void;
  side: "A" | "B";
  placeholder?: string;
}) {
  const t = useT(m);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    requestAnimationFrame(() => input.current?.focus());
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const sorted = useMemo(
    () => [...clubs].sort((a, b) => b.elo - a.elo || a.name.localeCompare(b.name)),
    [clubs],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);
  const showCustom = query.trim().length > 1 && !clubs.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());
  const total = filtered.length + (showCustom ? 1 : 0);

  const selected = value?.kind === "club" ? clubs.find((c) => c.id === value.id) : null;
  const name = choiceName(value, clubs);

  const commit = (i: number) => {
    if (i < filtered.length) onChange({ kind: "club", id: filtered[i].id });
    else if (showCustom) onChange({ kind: "custom", name: query.trim() });
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setActive(0);
        }}
        className={cn(
          "group flex w-full items-center gap-3 rounded-2xl border bg-surface-2 p-3 text-left transition-all",
          open ? "border-line-strong" : "border-line hover:border-line-strong",
          name && (side === "A" ? "shadow-[inset_3px_0_0_var(--team-a)]" : "shadow-[inset_3px_0_0_var(--team-b)]"),
        )}
      >
        {name ? (
          <ClubCrest name={name} size="lg" />
        ) : (
          <span className="grid h-[50px] w-[44px] place-items-center rounded-xl border border-dashed border-line-strong text-faint">
            ?
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate font-semibold", !name && "text-muted")}>{name || placeholder || t("choose")}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted">
            {selected ? (
              <>
                <Stars value={clubStars(selected.elo)} />
                <span className="tabular">{t("elo", { elo: selected.elo })}</span>
              </>
            ) : value?.kind === "custom" ? (
              t("custom")
            ) : (
              t("searchAll")
            )}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-faint group-hover:text-muted" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="card absolute inset-x-0 top-full z-30 mt-2 overflow-hidden p-0 shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 text-faint" />
              <input
                ref={input}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(total - 1, a + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(0, a - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (total) commit(active);
                  } else if (e.key === "Escape") setOpen(false);
                }}
                placeholder={t("searchPlaceholder")}
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-faint"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto p-1.5">
              {filtered.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(i)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                      i === active && "bg-surface-3",
                    )}
                  >
                    <ClubCrest name={c.name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <Stars value={clubStars(c.elo)} />
                    <span className="tabular w-10 text-right text-xs text-muted">{c.elo}</span>
                    {selected?.id === c.id && <Check className="size-4 text-accent-text" />}
                  </button>
                </li>
              ))}
              {showCustom && (
                <li>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(filtered.length)}
                    onClick={() => commit(filtered.length)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm",
                      active === filtered.length && "bg-surface-3",
                    )}
                  >
                    <span className="grid size-6 place-items-center rounded-md bg-surface-3 text-muted">
                      <PenLine className="size-3.5" />
                    </span>
                    {t("useCustom", { name: query.trim() })}
                  </button>
                </li>
              )}
              {!total && <li className="px-3 py-6 text-center text-sm text-muted">{t("noMatch")}</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
