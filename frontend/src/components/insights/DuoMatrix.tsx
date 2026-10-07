import { useMemo } from "react";
import { scoreRate, type Bucket, type DuoProfile } from "../../lib/analysis";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { Avatar } from "../ui/Identity";
import { useT } from "../../hooks/useI18n";
import { insightMessages } from "./messages";

/** Background for a record: green when the row duo dominates, red when it struggles, faint with few games. */
function heat(record: Bucket) {
  const t = (scoreRate(record) - 50) / 50;
  const weight = Math.min(1, record.played / 4);
  const strength = Math.round((12 + Math.abs(t) * 55) * weight);
  return `color-mix(in oklab, ${t >= 0 ? "var(--win)" : "var(--loss)"} ${strength}%, var(--surface-2))`;
}

/** Rows: duos. Columns: individual opponents. Each cell: how the duo fared with that player on the other side. */
export function DuoMatrix({
  duos,
  players,
  selected,
  onSelect,
}: {
  duos: DuoProfile[];
  players: string[];
  selected?: string;
  onSelect: (key: string) => void;
}) {
  const t = useT(insightMessages);
  const cols = useMemo(
    () => players.filter((p) => duos.some((d) => d.vsPlayers.some((v) => v.key === p))),
    [duos, players],
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface px-2 text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
              {t("matrixCorner")}
            </th>
            {cols.map((p) => (
              <th key={p} className="px-1 pb-1 font-medium">
                <div className="flex flex-col items-center gap-1">
                  <Avatar name={p} size="sm" />
                  <span className="max-w-16 truncate text-[11px] text-muted">{displayName(p)}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {duos.map((d) => {
            const vs = new Map(d.vsPlayers.map((v) => [v.key, v.record]));
            return (
              <tr key={d.key} onClick={() => onSelect(d.key)} className="group cursor-pointer">
                <td
                  className={cn(
                    "sticky left-0 z-10 rounded-lg bg-surface px-2 py-1.5 transition-colors group-hover:bg-surface-2",
                    selected === d.key && "bg-surface-3",
                  )}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="flex -space-x-2">
                      {d.names.map((n) => (
                        <Avatar key={n} name={n} size="xs" className="ring-2 ring-surface" />
                      ))}
                    </span>
                    <span className="font-medium">{d.names.map(displayName).join(" & ")}</span>
                    <span className="text-faint">{d.record.played}</span>
                  </div>
                </td>
                {cols.map((p) => {
                  const r = vs.get(p);
                  if (d.names.includes(p))
                    return <td key={p} className="rounded-lg bg-[repeating-linear-gradient(135deg,var(--surface-2)_0_4px,transparent_4px_8px)]" />;
                  if (!r) return <td key={p} className="rounded-lg bg-surface-2/40" />;
                  return (
                    <td
                      key={p}
                      className="tabular rounded-lg px-2 py-1.5 text-center font-semibold whitespace-nowrap"
                      style={{ background: heat(r) }}
                      title={t("cellTip", { duo: d.names.map(displayName).join(" & "), player: displayName(p), w: r.wins, d: r.draws, l: r.losses })}
                    >
                      {r.wins}-{r.draws}-{r.losses}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
