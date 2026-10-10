import { useT } from "../../hooks/useI18n";
import type { ClubRecord } from "../../lib/clubs";
import { cn } from "../../lib/cn";
import { formatDay } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import { FormPills } from "../ui/primitives";

const m = defineMessages({
  en: {
    form: "Form",
    record: "{n} match · {w}W {d}D {l}L|{n} matches · {w}W {d}D {l}L",
    none: "No matches with this club yet",
    game: "{date} · vs {opp} {gf}–{ga}",
  },
  tr: {
    form: "Form",
    record: "{n} maç · {w}G {d}B {l}M|{n} maç · {w}G {d}B {l}M",
    none: "Bu kulüple henüz maç yok",
    game: "{date} · {opp} karşısında {gf}–{ga}",
  },
});

/** A club's last five results with us, newest first, and its record; each pill names the match. */
export function ClubForm({ record, align = "start", className }: { record: ClubRecord; align?: "start" | "end"; className?: string }) {
  const t = useT(m);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted", align === "end" && "justify-end", className)}>
      <span className="label">{t("form")}</span>
      <FormPills
        outcomes={record.outcomes}
        size="sm"
        titles={record.games.map((g) => t("game", { date: formatDay(g.date), opp: g.opponent, gf: g.gf, ga: g.ga }))}
      />
      <span className="tabular">
        {record.played
          ? t("record", { n: record.played, w: record.wins, d: record.draws, l: record.losses })
          : t("none")}
      </span>
    </div>
  );
}
