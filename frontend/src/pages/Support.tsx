import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PublicLayout } from "../components/board/PublicLayout";
import { useT } from "../hooks/useI18n";
import { publicApi } from "../lib/api";
import { defineMessages } from "../lib/i18n";

// how the app works, kept in step with what it does: sign-in (accounts), invites, photos (AiConsent),
// reporting and blocking (moderation), deleting an account (DeleteAccount); the contact address is SUPPORT_EMAIL on the server (/config)
const m = defineMessages({
  en: {
    eyebrow: "Support",
    title: "Help",
    lead: "Matchnight is a small app for groups of friends to keep their match nights. How the main things work, and where to ask.",
    signTitle: "Signing in",
    sign1: "There are no passwords: enter your e-mail and we send you a six-digit code. Type it where you asked for it; it works once, for 15 minutes.",
    sign2: "The same e-mail has a link too: tapping it signs you in, in the browser it opens.",
    sign3: "No e-mail? Look in your spam folder, or ask for a new code. If the app says the e-mail couldn't be sent, try again a little later.",
    leaguesTitle: "Leagues and invites",
    leagues1: "Leagues are private: you get in with an invite from the league's owner or an admin.",
    leagues2: "A personal link is for one player and makes you that player straight away. A group link asks who you are, and an owner or admin confirms it; until then you can look around but not log matches.",
    leagues3: "Anyone can start a league of their own from their profile and invite their group.",
    photosTitle: "Match photos",
    photos1: "Adding photos of the match summary screen is optional. The first time, the app asks whether an AI service, Anthropic's Claude, may read their stats; you can change that next to the photos.",
    safetyTitle: "Reporting and blocking",
    safety1: "Something offensive? Open the photo, or the player's page, and tap Report. Reports come to us, not to the league, and we look at each one within 24 hours.",
    safety2: "Block, on a player's page, hides that person's photos from you in every league you share. Whom you blocked is under Profile › Edit.",
    safety3: "A league's owner and admins can remove someone in Settings › Members; Remove and block also keeps them out.",
    safety4: "You can leave a league from your account menu. The terms of use say what isn't allowed.",
    deleteTitle: "Deleting your account",
    delete1: "Profile › Edit › Delete account. Before anything is deleted, it shows what happens to each of your leagues.",
    delete2: "Your e-mail, name and photo go at once. A league you own passes to another member, or goes with your account if nobody else is in it.",
    contactTitle: "Contact",
    contact: "Write to us at {email}.",
    privacy: "What we keep and who sees it",
    terms: "Terms of use",
  },
  tr: {
    eyebrow: "Destek",
    title: "Yardım",
    lead: "Matchnight, arkadaş gruplarının maç gecelerini tutması için yapılmış küçük bir uygulama. Temel şeyler nasıl çalışır ve nereye sorarsın, burada.",
    signTitle: "Giriş",
    sign1: "Şifre yok: e-postanı yaz, sana 6 haneli bir kod gönderelim. Kodu istediğin yere yaz; bir kez ve 15 dakika boyunca geçerli.",
    sign2: "Aynı e-postada bir link de var: dokunursan açıldığı tarayıcıda giriş yapar.",
    sign3: "E-posta gelmediyse spam klasörüne bak ya da yeni kod iste. Uygulama e-postanın gönderilemediğini söylerse biraz sonra tekrar dene.",
    leaguesTitle: "Ligler ve davetler",
    leagues1: "Ligler gizlidir: ligin sahibinden ya da bir yöneticisinden gelen davetle girersin.",
    leagues2: "Kişiye özel link tek bir oyuncu içindir ve seni hemen o oyuncu yapar. Grup linki kim olduğunu sorar, sonra sahip ya da bir yönetici onaylar; o zamana kadar ligi gezebilirsin ama maç giremezsin.",
    leagues3: "Herkes profilinden kendi ligini kurup grubunu davet edebilir.",
    photosTitle: "Maç fotoğrafları",
    photos1: "Maç özeti ekranının fotoğrafını eklemek isteğe bağlı. İlk seferde uygulama, istatistikleri bir yapay zekâ servisinin (Anthropic'in Claude'u) okuyup okumayacağını sorar; bunu fotoğrafların yanından değiştirebilirsin.",
    safetyTitle: "Bildirme ve engelleme",
    safety1: "Uygunsuz bir şey mi var? Fotoğrafı ya da oyuncunun sayfasını aç ve Bildir'e dokun. Bildirimler lige değil bize gelir ve her birine 24 saat içinde bakarız.",
    safety2: "Oyuncu sayfasındaki Engelle, o kişinin fotoğraflarını ortak olduğunuz her ligde senden gizler. Kimi engellediğin Profilim › Düzenle'de.",
    safety3: "Ligin sahibi ve yöneticileri birini Ayarlar › Üyeler'den çıkarabilir; Çıkar ve engelle geri girmesini de önler.",
    safety4: "Bir ligden hesap menünden ayrılabilirsin. Neyin yasak olduğu kullanım koşullarında yazar.",
    deleteTitle: "Hesabını silmek",
    delete1: "Profilim › Düzenle › Hesabı sil. Silmeden önce her ligine ne olacağını gösterir.",
    delete2: "E-postan, adın ve fotoğrafın hemen silinir. Sahibi olduğun bir lig başka bir üyeye geçer, başka kimse yoksa hesabınla birlikte silinir.",
    contactTitle: "İletişim",
    contact: "Bize {email} adresinden yazabilirsin.",
    privacy: "Neyi sakladığımız ve kimin ne gördüğü",
    terms: "Kullanım koşulları",
  },
});

type Key = keyof typeof m.en;

const SECTIONS: { title: Key; items: Key[] }[] = [
  { title: "signTitle", items: ["sign1", "sign2", "sign3"] },
  { title: "leaguesTitle", items: ["leagues1", "leagues2", "leagues3"] },
  { title: "photosTitle", items: ["photos1"] },
  { title: "safetyTitle", items: ["safety1", "safety2", "safety3", "safety4"] },
  { title: "deleteTitle", items: ["delete1", "delete2"] },
];

/** "Write to us at {email}." with the address as a mail link. */
function Contact({ email }: { email: string }) {
  const t = useT(m);
  const [before, after = ""] = t("contact", { email }).split(email);
  return (
    <p className="text-muted">
      {before}
      <a href={`mailto:${email}`} className="font-semibold text-accent-text hover:underline">
        {email}
      </a>
      {after}
    </p>
  );
}

/** /support: how the app works and where to write; linked from the privacy page and the account menu. */
export default function Support() {
  const t = useT(m);
  const config = useQuery({ queryKey: ["config"], queryFn: publicApi.config, staleTime: 5 * 60_000 });
  const email = config.data?.supportEmail;
  return (
    <PublicLayout>
      <article className="mx-auto max-w-2xl py-6 sm:py-12">
        <p className="label text-accent-text">{t("eyebrow")}</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 text-muted">{t("lead")}</p>
        <div className="mt-8 space-y-4">
          {SECTIONS.map((s) => (
            <section key={s.title} className="card p-5 sm:p-6">
              <h2 className="font-semibold">{t(s.title)}</h2>
              <ul className="mt-3 space-y-2.5 text-sm text-muted">
                {s.items.map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{t(k)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="card space-y-2.5 p-5 text-sm sm:p-6">
            <h2 className="font-semibold">{t("contactTitle")}</h2>
            {email && <Contact email={email} />}
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <Link to="/privacy" className="font-semibold text-accent-text hover:underline">
                {t("privacy")} →
              </Link>
              <Link to="/terms" className="font-semibold text-accent-text hover:underline">
                {t("terms")} →
              </Link>
            </p>
          </section>
        </div>
      </article>
    </PublicLayout>
  );
}
