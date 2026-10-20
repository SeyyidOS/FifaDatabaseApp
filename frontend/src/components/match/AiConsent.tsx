import { Sparkles } from "lucide-react";
import { useState } from "react";
import { setAiPhotos, useAiPhotos } from "../../hooks/useAiPhotos";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";
import { Modal } from "../ui/Dialog";
import { Button } from "../ui/primitives";

const m = defineMessages({
  en: {
    title: "Read the stats with AI?",
    send: "A photo of the match summary screen can be sent to an AI service, Anthropic's Claude, which reads the stats and fills them in. The photo is used for nothing else.",
    keep: "Or only keep the photos: nothing is sent anywhere, and you can type the stats in yourself.",
    yes: "Yes, read them",
    no: "Only keep the photos",
    once: "Asked once on this device. You can change it next to the photos.",
    on: "Stats read by AI",
    off: "Photos only kept",
    change: "Change",
  },
  tr: {
    title: "İstatistikleri yapay zekâ okusun mu?",
    send: "Maç özeti ekranının fotoğrafı bir yapay zekâ servisine (Anthropic'in Claude'u) gönderilir; istatistikleri okuyup doldurur. Fotoğraf başka hiçbir şey için kullanılmaz.",
    keep: "İstersen fotoğrafları sadece sakla: hiçbir yere gönderilmez, istatistikleri kendin de girebilirsin.",
    yes: "Evet, okusun",
    no: "Sadece fotoğrafı sakla",
    once: "Bu cihazda bir kez sorulur. Fotoğrafların yanından değiştirebilirsin.",
    on: "İstatistikleri yapay zekâ okur",
    off: "Fotoğraflar sadece saklanır",
    change: "Değiştir",
  },
});

/** Asks whether this device's match photos may go to the AI service that reads stats (App Store 5.1.2(i)). */
export function AiConsent({ open, onClose, onAnswer }: { open: boolean; onClose: () => void; onAnswer: () => void }) {
  const t = useT(m);
  const answer = (value: boolean) => {
    setAiPhotos(value);
    onAnswer();
  };
  return (
    <Modal open={open} onClose={onClose} labelledBy="ai-consent-title">
      <div className="space-y-4">
        <span className="grid size-10 place-items-center rounded-xl bg-accent/12 text-accent-text ring-1 ring-accent/25">
          <Sparkles className="size-5" />
        </span>
        <h3 id="ai-consent-title" className="text-lg font-semibold">
          {t("title")}
        </h3>
        <div className="space-y-2 text-sm text-muted">
          <p>{t("send")}</p>
          <p>{t("keep")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="primary" size="lg" onClick={() => answer(true)}>
            {t("yes")}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => answer(false)}>
            {t("no")}
          </Button>
        </div>
        <p className="text-center text-[11px] text-faint">{t("once")}</p>
      </div>
    </Modal>
  );
}

/** What this device answered, with a way to change it; nothing until it was asked. */
export function AiNote({ className }: { className?: string }) {
  const t = useT(m);
  const ai = useAiPhotos();
  const [asking, setAsking] = useState(false);
  if (ai === null) return null;
  return (
    <p className={className}>
      <Sparkles className="mr-1 inline size-3 align-[-2px]" />
      {t(ai ? "on" : "off")} ·{" "}
      <button type="button" onClick={() => setAsking(true)} className="font-semibold underline-offset-2 hover:underline">
        {t("change")}
      </button>
      <AiConsent open={asking} onClose={() => setAsking(false)} onAnswer={() => setAsking(false)} />
    </p>
  );
}
