import { cn } from "../../lib/cn";
import { scoreRate, type Bucket } from "../../lib/analysis";

/** W–D–L counts, a proportional bar and the share of points taken. */
export function RecordStrip({ record, className }: { record: Bucket; className?: string }) {
  const { wins, draws, losses, played } = record;
  const w = (n: number) => `${played ? (n / played) * 100 : 0}%`;
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="tabular w-[4.5rem] shrink-0 text-xs">
        <span className="font-semibold text-win">{wins}</span>
        <span className="text-faint">–</span>
        <span className="font-semibold text-draw">{draws}</span>
        <span className="text-faint">–</span>
        <span className="font-semibold text-loss">{losses}</span>
      </span>
      <span className="flex h-1.5 min-w-6 flex-1 overflow-hidden rounded-full bg-surface-3">
        <span className="h-full bg-win" style={{ width: w(wins) }} />
        <span className="h-full bg-draw" style={{ width: w(draws) }} />
        <span className="h-full bg-loss" style={{ width: w(losses) }} />
      </span>
      <span className="tabular w-10 shrink-0 text-right text-xs font-semibold">{Math.round(scoreRate(record))}%</span>
    </div>
  );
}
