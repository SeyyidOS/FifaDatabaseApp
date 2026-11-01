import { defineMessages } from "../../lib/i18n";

/** Reporting a photo or a player (Report.tsx); the profile and the photo viewer use the button's word too. */
export const reportMessages = defineMessages({
  en: {
    report: "Report",
    photoTitle: "Report this photo",
    playerTitle: "Report {name}",
    lead: "It goes to the people who run Matchnight, not to the league; we look at every report within 24 hours.",
    offensive: "Offensive or inappropriate",
    harassment: "Harassment or bullying",
    impersonation: "Pretending to be someone",
    other: "Something else",
    note: "Anything we should know? (optional)",
    send: "Send report",
    sent: "Thanks. We'll look at it within 24 hours.",
  },
  tr: {
    report: "Bildir",
    photoTitle: "Bu fotoğrafı bildir",
    playerTitle: "{name} adlı oyuncuyu bildir",
    lead: "Bildirim lige değil, Matchnight'ı yönetenlere gider; her bildirime 24 saat içinde bakarız.",
    offensive: "Uygunsuz ya da hakaret içeriyor",
    harassment: "Taciz ya da zorbalık",
    impersonation: "Başkası gibi davranıyor",
    other: "Başka bir şey",
    note: "Bilmemiz gereken bir şey var mı? (isteğe bağlı)",
    send: "Bildirimi gönder",
    sent: "Teşekkürler. 24 saat içinde bakacağız.",
  },
});
