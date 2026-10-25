import { Link } from "react-router-dom";
import { PublicLayout } from "../components/board/PublicLayout";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";

// what the app really keeps and sends: keep it in step with the backend (accounts, invites, photos,
// avatars, mailer) and with deploy/match-stats.py, which has a model read the stat photos
const m = defineMessages({
  en: {
    eyebrow: "Privacy",
    title: "What we keep",
    lead: "Matchnight is a small app for groups of friends to keep their match nights. Here is what it stores, why, and who sees it.",
    updated: "Last updated 25 October 2026",
    storeTitle: "What is stored",
    store1: "Your e-mail address, to send you sign-in codes. There are no passwords, so none are stored.",
    store2: "Your name and, if you add one, your profile photo.",
    store3: "Which leagues you are in, your role there, and which player you are.",
    store4: "What a league logs: matches, scores, clubs, match stats and match photos.",
    store5: "Technical logs: the server keeps the IP address and time of requests for a while, to find and fix problems.",
    seeTitle: "Who sees what",
    see1: "Leagues are private: nobody sees one without an invite.",
    see2: "A league's members see its players, matches, stats and match photos, and your name and profile photo.",
    see3: "Other members don't see your e-mail address. Only when you ask to join by a group link do the league's owner and admins see it, so they can tell who is asking.",
    see4: "The person who runs the app can reach everything on the server, and uses it only to run the app.",
    sendTitle: "Services it uses",
    send1: "Sign-in e-mails are sent through Resend, which gets your e-mail address and the code.",
    send2: "If you allow it when you add match photos, an AI service, Anthropic's Claude, reads the stats from them: the photo is sent to it for that and nothing else. Without your say-so a photo is only kept.",
    send3: "No ads, no analytics, no trackers. Your data is not sold.",
    send4: "Each night the database and the photos are backed up to Backblaze (B2), encrypted before they leave: the database's last 30 nights and the photos' last 7 are kept. Only whoever runs the app holds the key that opens them.",
    deviceTitle: "On your device",
    device1: "Your sign-in, language and theme are kept in your browser's local storage. No cookies.",
    deleteTitle: "Deleting and questions",
    delete1: "You can remove your profile photo, or delete your whole account, yourself: Profile › Edit › Delete account. Your e-mail, name and photo go at once; a league you own passes to another member, or goes with your account if nobody else is in it.",
    delete2: "For anything else, see Help: how the app works and where to write.",
    delete3: "If you leave or are removed from a league, your matches stay in it as part of its history; they are no longer tied to your account.",
    help: "Help and contact",
  },
  tr: {
    eyebrow: "Gizlilik",
    title: "Neyi saklıyoruz",
    lead: "Matchnight, arkadaş gruplarının maç gecelerini tutması için yapılmış küçük bir uygulama. Neyi, neden sakladığı ve kimin ne gördüğü aşağıda.",
    updated: "Son güncelleme: 25 Ekim 2026",
    storeTitle: "Neler saklanır",
    store1: "E-posta adresin: giriş kodlarını göndermek için. Şifre yok, dolayısıyla şifre de saklanmaz.",
    store2: "Adın ve eklersen profil fotoğrafın.",
    store3: "Hangi liglerde olduğun, oradaki rolün ve hangi oyuncu olduğun.",
    store4: "Bir ligin girdiği her şey: maçlar, skorlar, kulüpler, maç istatistikleri ve maç fotoğrafları.",
    store5: "Teknik kayıtlar: sunucu, sorunları bulup düzeltmek için isteklerin IP adresini ve zamanını bir süre tutar.",
    seeTitle: "Kim neyi görür",
    see1: "Ligler gizlidir: davet olmadan kimse bir ligi göremez.",
    see2: "Bir ligin üyeleri o ligin oyuncularını, maçlarını, istatistiklerini ve maç fotoğraflarını, senin de adını ve profil fotoğrafını görür.",
    see3: "E-posta adresini diğer üyeler görmez. Sadece grup linkiyle katılmak istediğinde, kimin istediğini anlasınlar diye ligin sahibi ve yöneticileri görür.",
    see4: "Uygulamayı yöneten kişi sunucudaki her şeye erişebilir ve bunları sadece uygulamayı çalıştırmak için kullanır.",
    sendTitle: "Kullandığı servisler",
    send1: "Giriş e-postaları Resend üzerinden gönderilir; Resend e-posta adresini ve kodu görür.",
    send2: "Maç fotoğrafı eklerken izin verirsen istatistikleri bir yapay zekâ servisi (Anthropic'in Claude'u) okur; fotoğraf sadece bunun için ona gönderilir. İzin vermezsen fotoğraf sadece saklanır.",
    send3: "Reklam, analiz ya da takip aracı yok. Verilerin satılmaz.",
    send4: "Veritabanı ve fotoğraflar her gece, sunucudan çıkmadan şifrelenip Backblaze'de (B2) yedeklenir: veritabanının son 30, fotoğrafların son 7 gecesi tutulur. Yedekleri açan anahtar sadece uygulamayı yöneten kişidedir.",
    deviceTitle: "Cihazında",
    device1: "Giriş bilgin, dil ve tema tercihin tarayıcının yerel depolamasında tutulur. Çerez yok.",
    deleteTitle: "Silme ve sorular",
    delete1: "Profil fotoğrafını ya da hesabının tamamını kendin silebilirsin: Profilim › Düzenle › Hesabı sil. E-postan, adın ve fotoğrafın hemen silinir; sahibi olduğun bir lig başka bir üyeye geçer, başka kimse yoksa hesabınla birlikte silinir.",
    delete2: "Başka bir sorun ya da soru için Yardım sayfasına bak: uygulama nasıl çalışır ve nereye yazarsın.",
    delete3: "Bir ligden ayrılır ya da çıkarılırsan maçların ligin geçmişinin parçası olarak orada kalır; hesabınla bağı kopar.",
    help: "Yardım ve iletişim",
  },
});

type Key = keyof typeof m.en;

const SECTIONS: { title: Key; items: Key[] }[] = [
  { title: "storeTitle", items: ["store1", "store2", "store3", "store4", "store5"] },
  { title: "seeTitle", items: ["see1", "see2", "see3", "see4"] },
  { title: "sendTitle", items: ["send1", "send2", "send4", "send3"] },
  { title: "deviceTitle", items: ["device1"] },
  { title: "deleteTitle", items: ["delete1", "delete2", "delete3"] },
];

/** /privacy: one page, linked from the public pages' footer and the account menu. */
export default function Privacy() {
  const t = useT(m);
  return (
    <PublicLayout>
      <article className="mx-auto max-w-2xl py-6 sm:py-12">
        <p className="label text-accent-text">{t("eyebrow")}</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="mt-4 text-muted">{t("lead")}</p>
        <p className="mt-2 text-xs text-faint">{t("updated")}</p>
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
        </div>
        <p className="mt-6 text-sm">
          <Link to="/support" className="font-semibold text-accent-text hover:underline">
            {t("help")} →
          </Link>
        </p>
      </article>
    </PublicLayout>
  );
}
