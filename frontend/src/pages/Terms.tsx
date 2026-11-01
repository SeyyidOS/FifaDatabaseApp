import { Link } from "react-router-dom";
import { PublicLayout } from "../components/board/PublicLayout";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";

// The terms every account agrees to once (TermsGate; backend accounts.TERMS_VERSION, raised when they change
// in a way people should agree to again). Keep "what happens" in step with backend/moderation.py.
const m = defineMessages({
  en: {
    eyebrow: "Terms",
    title: "Terms of use",
    lead: "Matchnight is for groups of friends to keep their match nights. Using it means agreeing to these terms. The short version: be decent. There is no tolerance for offensive content or for abusing anyone.",
    updated: "Last updated 1 November 2026",
    notTitle: "What's not allowed",
    not1: "Slurs, hate, or attacks on anyone for who they are.",
    not2: "Harassing, bullying or threatening anyone.",
    not3: "Sexual, violent or otherwise offensive names and photos.",
    not4: "Pretending to be someone else, or adding someone's photo or personal details without their OK.",
    not5: "Anything illegal, and spam.",
    doTitle: "What happens",
    do1: "Anyone in a league can report a photo or a player. Reports come to us, and we look at each one within 24 hours.",
    do2: "We remove what breaks these terms, and suspend the account that posted it; a suspended account can't sign in.",
    do3: "A league's owner and admins can delete photos and matches, and remove people from the league and keep them out.",
    do4: "You can block someone: their photos are no longer shown to you. You can also leave a league at any time.",
    yoursTitle: "Your content and the app",
    yours1: "What you add stays yours. You let us store it and show it to your league, which is what the app is for. You are responsible for what you add.",
    yours2: "The app is free and comes as it is. We may change it, and we may suspend or delete accounts that break these terms.",
    yours3: "If you use the iPhone app, Apple's standard licence agreement for App Store apps applies too.",
    yours4: "You can delete your account whenever you like: Profile › Edit › Delete account.",
    privacy: "What we keep and who sees it",
    help: "Help and contact",
  },
  tr: {
    eyebrow: "Koşullar",
    title: "Kullanım koşulları",
    lead: "Matchnight, arkadaş gruplarının maç gecelerini tutması için. Kullanmak bu koşulları kabul etmek demek. Kısacası: saygılı ol. Uygunsuz içeriğe ve kimseye kötü davranılmasına hiç tolerans yok.",
    updated: "Son güncelleme: 1 Kasım 2026",
    notTitle: "Neler yasak",
    not1: "Hakaret, nefret söylemi ya da birine kim olduğu için saldırmak.",
    not2: "Birini taciz etmek, zorbalık yapmak ya da tehdit etmek.",
    not3: "Cinsel, şiddet içeren ya da başka şekilde uygunsuz isimler ve fotoğraflar.",
    not4: "Başkası gibi davranmak ya da birinin fotoğrafını veya kişisel bilgilerini izni olmadan eklemek.",
    not5: "Yasa dışı her şey ve spam.",
    doTitle: "Ne olur",
    do1: "Bir ligdeki herkes bir fotoğrafı ya da oyuncuyu bildirebilir. Bildirimler bize gelir ve her birine 24 saat içinde bakarız.",
    do2: "Bu koşullara aykırı olanı kaldırır, ekleyen hesabı askıya alırız; askıya alınan hesapla giriş yapılamaz.",
    do3: "Ligin sahibi ve yöneticileri fotoğrafları ve maçları silebilir, birini ligden çıkarıp geri girmesini engelleyebilir.",
    do4: "Birini engelleyebilirsin: fotoğrafları artık sana gösterilmez. İstediğin zaman bir ligden ayrılabilirsin de.",
    yoursTitle: "İçeriğin ve uygulama",
    yours1: "Eklediklerin senin kalır. Bunları saklamamıza ve liginde göstermemize izin verirsin; uygulama zaten bunun için. Eklediklerinden sen sorumlusun.",
    yours2: "Uygulama ücretsizdir ve olduğu gibi sunulur. Onu değiştirebilir, bu koşullara aykırı hesapları askıya alabilir ya da silebiliriz.",
    yours3: "iPhone uygulamasını kullanıyorsan Apple'ın App Store uygulamaları için standart lisans sözleşmesi de geçerlidir.",
    yours4: "Hesabını istediğin zaman silebilirsin: Profilim › Düzenle › Hesabı sil.",
    privacy: "Neyi sakladığımız ve kimin ne gördüğü",
    help: "Yardım ve iletişim",
  },
});

type Key = keyof typeof m.en;

const SECTIONS: { title: Key; items: Key[] }[] = [
  { title: "notTitle", items: ["not1", "not2", "not3", "not4", "not5"] },
  { title: "doTitle", items: ["do1", "do2", "do3", "do4"] },
  { title: "yoursTitle", items: ["yours1", "yours2", "yours3", "yours4"] },
];

/** /terms: what everyone agrees to (TermsGate asks once); linked from the public pages' footer and the account menu. */
export default function Terms() {
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
        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link to="/privacy" className="font-semibold text-accent-text hover:underline">
            {t("privacy")} →
          </Link>
          <Link to="/support" className="font-semibold text-accent-text hover:underline">
            {t("help")} →
          </Link>
        </p>
      </article>
    </PublicLayout>
  );
}
