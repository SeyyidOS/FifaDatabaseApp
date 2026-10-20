import { Store } from "lucide-react";
import { useT } from "../../hooks/useI18n";
import { PREVIEWING, setStorePreview, SITE_EDITION } from "../../lib/edition";
import { defineMessages } from "../../lib/i18n";
import { Button, Panel } from "../ui/primitives";

const m = defineMessages({
  en: {
    title: "App Store edition",
    sub: "Try on this device what the App Store app shows",
    what: "Kits instead of crests, ratings without the game's cards, no squads. Only this device changes; everyone else sees the league as before.",
    on: "Preview on this device",
    off: "End the preview",
  },
  tr: {
    title: "App Store sürümü",
    sub: "App Store uygulamasının gösterdiğini bu cihazda dene",
    what: "Armalar yerine formalar, oyunun kartları olmadan puanlar, kadrolar yok. Sadece bu cihaz değişir; diğer herkes ligi her zamanki gibi görür.",
    on: "Bu cihazda önizle",
    off: "Önizlemeyi kapat",
  },
});

/** Settings, for a league's owner on the classic site: this device previews the store edition. */
export function StorePreview() {
  const t = useT(m);
  if (SITE_EDITION === "store") return null;
  return (
    <Panel title={t("title")} subtitle={t("sub")} icon={<Store className="size-4" />} bodyClassName="space-y-3 p-5">
      <p className="text-sm text-muted">{t("what")}</p>
      <Button variant={PREVIEWING ? "secondary" : "primary"} onClick={() => setStorePreview(!PREVIEWING)}>
        {PREVIEWING ? t("off") : t("on")}
      </Button>
    </Panel>
  );
}
