import { Shirt } from "lucide-react";
import { setCrestStyle, useCrestStyle, type CrestStyle } from "../../hooks/useCrestStyle";
import { useT } from "../../hooks/useI18n";
import { cn } from "../../lib/cn";
import { has } from "../../lib/edition";
import { defineMessages } from "../../lib/i18n";
import { BADGE_STYLES } from "../../lib/kits";
import { ClubCrest } from "../ui/Identity";
import { Panel } from "../ui/primitives";

const m = defineMessages({
  en: {
    title: "Club badges",
    sub: "The App Store app can't use real crests; try its drawn badges on this device.",
    real: "Real crests",
    kit: "Kit",
    roundel: "Roundel",
    shield: "Shield",
    tile: "Letters",
    only: "Only this device changes; everyone else sees the league as before.",
  },
  tr: {
    title: "Kulüp armaları",
    sub: "App Store sürümü gerçek arma kullanamaz; çizilen armaları bu cihazda dene.",
    real: "Gerçek armalar",
    kit: "Forma",
    roundel: "Rozet",
    shield: "Kalkan",
    tile: "Harfler",
    only: "Sadece bu cihaz değişir; diğer herkes ligi her zamanki gibi görür.",
  },
});

const SAMPLES = ["Barcelona", "Galatasaray", "Arsenal"];

/** Settings: try the store edition's drawn badges on this device. */
export function CrestLook() {
  const t = useT(m);
  const style = useCrestStyle();
  const looks: CrestStyle[] = [...(has("realCrests") ? (["real"] as const) : []), ...BADGE_STYLES];
  return (
    <Panel title={t("title")} subtitle={t("sub")} icon={<Shirt className="size-4" />} bodyClassName="space-y-3 p-5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t("title")}>
        {looks.map((look) => {
          const on = look === style;
          return (
            <button
              key={look}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCrestStyle(look === (has("realCrests") ? "real" : "kit") ? null : look)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl px-2 py-3 ring-1 transition",
                on ? "bg-accent/10 ring-accent" : "bg-surface-2 ring-line hover:ring-line-strong",
              )}
            >
              <span className="flex items-end gap-1.5">
                {SAMPLES.map((club) => (
                  <ClubCrest key={club} name={club} size="sm" look={look} />
                ))}
              </span>
              <span className={cn("text-xs font-medium", on ? "text-fg" : "text-muted")}>{t(look)}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-faint">{t("only")}</p>
    </Panel>
  );
}
