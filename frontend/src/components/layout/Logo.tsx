import { cn } from "../../lib/cn";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";

const m = defineMessages({
  en: { tagline: "Club Nights" },
  tr: { tagline: "FIFA Geceleri" },
});

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  const t = useT(m);
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid size-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-[0_8px_24px_-8px_var(--accent)]">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="m12 7.2 3.6 2.6-1.4 4.2H9.8L8.4 9.8Z" fill="currentColor" stroke="none" />
          <path d="M12 7.2V3.3M15.6 9.8l3.7-1.2M14.2 14l2.3 3.2M9.8 14l-2.3 3.2M8.4 9.8 4.7 8.6" strokeLinecap="round" />
        </svg>
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="display block text-[19px] tracking-[0.06em]">FIFA Manager</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-faint">
            {t("tagline")}
          </span>
        </span>
      )}
    </span>
  );
}
