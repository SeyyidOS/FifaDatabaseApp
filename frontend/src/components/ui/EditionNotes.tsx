import { Store, X } from "lucide-react";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { has, PREVIEWING, setStorePreview } from "../../lib/edition";
import { defineMessages } from "../../lib/i18n";

const m = defineMessages({
  en: {
    independent:
      "Matchnight is an independent app. It is not affiliated with or endorsed by EA SPORTS, FIFA or any football club; club names only say which club a match was played with.",
    preview: "Store edition preview",
    previewOff: "End the preview",
  },
  tr: {
    independent:
      "Matchnight bağımsız bir uygulamadır. EA SPORTS, FIFA ya da herhangi bir futbol kulübüyle bağlantılı değildir, onlar tarafından desteklenmez; kulüp adları sadece maçın hangi kulüple oynandığını belirtir.",
    preview: "Mağaza sürümü önizlemesi",
    previewOff: "Önizlemeyi kapat",
  },
});

/** The store edition's "not affiliated with EA or any club" line; nothing in the classic edition. */
export function IndependenceNote({ className }: { className?: string }) {
  const t = useT(m);
  if (!has("independenceNote")) return null;
  return <p className={cn("text-xs text-faint", className)}>{t("independent")}</p>;
}

/** While this device previews the store edition, a reminder at the top with a way out. */
export function PreviewBanner() {
  const t = useT(m);
  if (!PREVIEWING) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-team-b/40 bg-team-b/10 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 font-semibold text-team-b">
        <Store className="size-4 shrink-0" /> {t("preview")}
      </span>
      <button
        type="button"
        onClick={() => setStorePreview(false)}
        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted hover:text-fg"
      >
        <X className="size-3.5" /> {t("previewOff")}
      </button>
    </div>
  );
}
