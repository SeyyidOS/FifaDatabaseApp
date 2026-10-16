import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LockKeyhole, Scale, Swords, TrendingUp, X } from "lucide-react";
import { AccountHome } from "../components/account/AccountHome";
import { SignedOutForms } from "../components/account/LeagueForms";
import { BoardForms } from "../components/board/BoardForms";
import { PublicLayout } from "../components/board/PublicLayout";
import { Avatar } from "../components/ui/Identity";
import { Pill } from "../components/ui/primitives";
import { useAccount, useAccountsEnabled } from "../hooks/useAccount";
import { useSessions } from "../hooks/useBoard";
import { relativeTime } from "../lib/format";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";
import { common } from "../lib/messages";
import { removeSession } from "../lib/session";

const m = defineMessages({
  en: {
    onDevice: "On this device",
    forget: "Forget {name} on this device",
    forgetShort: "Forget on this device",
    eyebrow: "For match nights with friends",
    heroA: "Your league.",
    heroB: "Your rules.",
    heroText:
      "A private board for your group: every result, an Elo rating that rewards upsets, fair teams on demand and the bragging rights to go with it.",
    f1Title: "Ratings that mean something",
    f1: "Elo with club strength, goal margins and upset bonuses.",
    f2Title: "Fair teams in one tap",
    f2: "Balanced drafts that split up last game's partners.",
    f3Title: "Rivalries and records",
    f3: "Head-to-heads, streaks, nemeses and the hall of records.",
    f4Title: "Private by default",
    f4: "One password for the group, remembered on your devices.",
    f4Invite: "Only the people you invite get in, each with their own account.",
  },
  tr: {
    onDevice: "Bu cihazda",
    forget: "{name} board'unu bu cihazda unut",
    forgetShort: "Bu cihazda unut",
    eyebrow: "Arkadaşlarla maç geceleri için",
    heroA: "Senin ligin.",
    heroB: "Senin kuralların.",
    heroText:
      "Grubuna özel bir board: her sonuç, sürprizleri ödüllendiren bir Elo puanı, tek dokunuşla dengeli takımlar ve bunlarla gelen hava atma hakkı.",
    f1Title: "Anlamı olan puanlar",
    f1: "Kulüp gücü, gol farkı ve sürpriz bonuslu Elo.",
    f2Title: "Tek dokunuşla adil takımlar",
    f2: "Son maçın ortaklarını ayıran dengeli kura.",
    f3Title: "Rekabetler ve rekorlar",
    f3: "Karşılaşmalar, seriler, kâbuslar ve rekorlar kitabı.",
    f4Title: "Varsayılan olarak gizli",
    f4: "Grup için tek şifre, cihazlarında hatırlanır.",
    f4Invite: "Yalnızca davet ettiklerin girer, herkes kendi hesabıyla.",
  },
});

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-text ring-1 ring-line">
        {icon}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const t = useT(m);
  const tc = useT(common);
  const sessions = useSessions();
  const accounts = useAccountsEnabled();
  const account = useAccount();

  // signed in: Profilim, where this device's boards join the account's leagues in one list
  if (accounts && account)
    return (
      <PublicLayout>
        <AccountHome account={account} />
      </PublicLayout>
    );

  return (
    <PublicLayout>
      {sessions.length > 0 && (
        <section className="mt-4 mb-12">
          <p className="label mb-3">{t("onDevice")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s, i) => (
              <motion.div
                key={s.slug}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card card-hover group flex items-center gap-4 p-4"
              >
                <Link to={`/b/${s.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <Avatar name={s.name} size="lg" className="rounded-2xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{s.name}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <Pill tone={s.role === "admin" ? "accent" : "neutral"}>{tc(s.role)}</Pill>
                      {relativeTime(new Date(s.savedAt))}
                    </span>
                  </span>
                </Link>
                <button
                  onClick={() => removeSession(s.slug)}
                  className="rounded-lg p-1.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-2 hover:text-fg focus:opacity-100"
                  aria-label={t("forget", { name: s.name })}
                  title={t("forgetShort")}
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* phones: the way in right under the pitch, the features after it; side by side on large screens */}
      <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-x-16 lg:gap-y-9">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="pt-2 lg:pt-10">
          <p className="label text-accent-text">{t("eyebrow")}</p>
          <h1 className="display mt-4 text-6xl leading-[0.9] sm:text-7xl">
            {t("heroA")}
            <br />
            <span className="text-accent-text">{t("heroB")}</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted">{t("heroText")}</p>
        </motion.section>

        {/* with accounts, signing in comes first; a board password is the old way, folded away */}
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">{accounts ? <SignedOutForms /> : <BoardForms />}</div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="grid gap-5 sm:grid-cols-2 lg:col-start-1"
        >
          <Feature icon={<TrendingUp className="size-4" />} title={t("f1Title")}>
            {t("f1")}
          </Feature>
          <Feature icon={<Scale className="size-4" />} title={t("f2Title")}>
            {t("f2")}
          </Feature>
          <Feature icon={<Swords className="size-4" />} title={t("f3Title")}>
            {t("f3")}
          </Feature>
          <Feature icon={<LockKeyhole className="size-4" />} title={t("f4Title")}>
            {accounts ? t("f4Invite") : t("f4")}
          </Feature>
        </motion.div>
      </div>
    </PublicLayout>
  );
}
