import { cn } from "../../lib/cn";
import { BrandMark } from "./BrandMark";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";

const m = defineMessages({
  en: { tagline: "Match nights" },
  tr: { tagline: "Maç geceleri" },
});

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT(m);
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="size-9 shrink-0 overflow-hidden rounded-xl shadow-[0_8px_22px_-10px_rgba(40,170,80,0.8)] ring-1 ring-white/10">
        <BrandMark className="block size-full" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span lang="en" className="display block text-[19px] tracking-[0.06em]">
            Matchnight
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-faint">
            {t("tagline")}
          </span>
        </span>
      )}
    </span>
  );
}
