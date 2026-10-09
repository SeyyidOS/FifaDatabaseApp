import { motion } from "motion/react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, KeyRound, LockKeyhole, Scale, Swords, TrendingUp, X } from "lucide-react";
import { PublicLayout } from "../components/board/PublicLayout";
import { Avatar } from "../components/ui/Identity";
import { Checkbox, Field, PasswordInput, TextInput } from "../components/ui/form";
import { Button, Pill, Segmented } from "../components/ui/primitives";
import { useSessions } from "../hooks/useBoard";
import { ApiError, publicApi } from "../lib/api";
import { relativeTime } from "../lib/format";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";
import { common } from "../lib/messages";
import { removeSession, saveSession } from "../lib/session";

const m = defineMessages({
  en: {
    wrongPassword: "Wrong password",
    noBoard: "No board with that code",
    codeLabel: "Board code or invite link",
    codeHint: "Ask whoever runs the board for the link.",
    codePlaceholder: "e.g. friday-night",
    password: "Password",
    remember: "Remember this device",
    enter: "Enter board",
    needName: "Give the board a name",
    shortPassword: "The board password needs at least 6 characters",
    shortAdmin: "The admin password needs at least 6 characters",
    samePasswords: "Use different board and admin passwords",
    ready: "{name} is ready",
    readyHint: "Invite your friends from Settings.",
    createFailed: "Couldn't create the board",
    nameLabel: "Board name",
    namePlaceholder: "e.g. Friday Night FIFA",
    boardPassword: "Board password",
    boardPasswordHint: "Share it with your group: they can log matches.",
    adminPassword: "Admin password",
    adminPasswordHint: "Keep it to yourself: deleting, archiving and settings need it.",
    create: "Create board",
    onDevice: "On this device",
    forget: "Forget {name} on this device",
    forgetShort: "Forget on this device",
    eyebrow: "For FIFA nights with friends",
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
    joinTitle: "Join a board",
    createTitle: "Start a board",
    joinTab: "Join",
    createTab: "Create",
  },
  tr: {
    wrongPassword: "Şifre yanlış",
    noBoard: "Bu kodla bir board yok",
    codeLabel: "Board kodu ya da davet linki",
    codeHint: "Linki board'u yöneten kişiden iste.",
    codePlaceholder: "ör. cuma-gecesi",
    password: "Şifre",
    remember: "Bu cihazı hatırla",
    enter: "Board'a gir",
    needName: "Board'a bir isim ver",
    shortPassword: "Board şifresi en az 6 karakter olmalı",
    shortAdmin: "Yönetici şifresi en az 6 karakter olmalı",
    samePasswords: "Board ve yönetici şifreleri farklı olmalı",
    ready: "{name} hazır",
    readyHint: "Arkadaşlarını Ayarlar'dan davet et.",
    createFailed: "Board oluşturulamadı",
    nameLabel: "Board adı",
    namePlaceholder: "ör. Cuma Gecesi FIFA",
    boardPassword: "Board şifresi",
    boardPasswordHint: "Grubunla paylaş: maç girebilirler.",
    adminPassword: "Yönetici şifresi",
    adminPasswordHint: "Kendine sakla: silme, arşivleme ve ayarlar için gerekir.",
    create: "Board oluştur",
    onDevice: "Bu cihazda",
    forget: "{name} board'unu bu cihazda unut",
    forgetShort: "Bu cihazda unut",
    eyebrow: "Arkadaşlarla FIFA geceleri için",
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
    joinTitle: "Board'a katıl",
    createTitle: "Board kur",
    joinTab: "Katıl",
    createTab: "Kur",
  },
});

/** Accepts a board code ("kerems-crew") or a pasted invite link (".../#/b/kerems-crew/…"). */
function boardCode(input: string): string {
  const fromLink = input.match(/\/b\/([^/?#\s]+)/);
  return (fromLink ? fromLink[1] : input).trim().toLowerCase();
}

const errorText = (e: unknown, wrongPassword: string) =>
  e instanceof ApiError && e.status === 401 ? wrongPassword : (e as Error).message;

function JoinForm() {
  const t = useT(m);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const slug = boardCode(code);
    if (!slug || !password) return;
    setBusy(true);
    setError(null);
    try {
      const signIn = await publicApi.signIn(slug, password);
      saveSession(signIn, remember);
      navigate(`/b/${signIn.slug}`);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? t("noBoard") : errorText(err, t("wrongPassword")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("codeLabel")} htmlFor="join-code" hint={t("codeHint")}>
        <TextInput
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("codePlaceholder")}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
      <Field label={t("password")} htmlFor="join-password" error={error}>
        <PasswordInput
          id="join-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </Field>
      <Checkbox checked={remember} onChange={setRemember}>
        {t("remember")}
      </Checkbox>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!code || !password}>
        {t("enter")} <ArrowRight className="size-4" />
      </Button>
    </form>
  );
}

function CreateForm() {
  const t = useT(m);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const problem =
    name.trim().length < 2
      ? t("needName")
      : password.length < 6
        ? t("shortPassword")
        : adminPassword.length < 6
          ? t("shortAdmin")
          : password === adminPassword
            ? t("samePasswords")
            : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    try {
      const signIn = await publicApi.createBoard({ name: name.trim(), password, adminPassword });
      saveSession(signIn, remember);
      toast.success(t("ready", { name: signIn.name }), { description: t("readyHint") });
      navigate(`/b/${signIn.slug}/settings?welcome=1`);
    } catch (err) {
      toast.error(t("createFailed"), { description: errorText(err, t("wrongPassword")) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("nameLabel")} htmlFor="create-name">
        <TextInput
          id="create-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={60}
        />
      </Field>
      <Field label={t("boardPassword")} htmlFor="create-password" hint={t("boardPasswordHint")}>
        <PasswordInput
          id="create-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label={t("adminPassword")} htmlFor="create-admin" hint={t("adminPasswordHint")}>
        <PasswordInput
          id="create-admin"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Checkbox checked={remember} onChange={setRemember}>
        {t("remember")}
      </Checkbox>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!!problem}>
        {t("create")} <ArrowRight className="size-4" />
      </Button>
      {problem && (name || password || adminPassword) && <p className="text-center text-xs text-muted">{problem}</p>}
    </form>
  );
}

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
  const [tab, setTab] = useState<"join" | "create">("join");

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

      <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="pt-2 lg:pt-10">
          <p className="label text-accent-text">{t("eyebrow")}</p>
          <h1 className="display mt-4 text-6xl leading-[0.9] sm:text-7xl">
            {t("heroA")}
            <br />
            <span className="text-accent-text">{t("heroB")}</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted">{t("heroText")}</p>
          <div className="mt-9 grid gap-5 sm:grid-cols-2">
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
              {t("f4")}
            </Feature>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="card p-6 sm:p-8"
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <KeyRound className="size-5 text-accent-text" />
              {tab === "join" ? t("joinTitle") : t("createTitle")}
            </h2>
            <Segmented
              value={tab}
              onChange={setTab}
              size="sm"
              options={[
                { value: "join", label: t("joinTab") },
                { value: "create", label: t("createTab") },
              ]}
            />
          </div>
          {tab === "join" ? <JoinForm /> : <CreateForm />}
        </motion.section>
      </div>
    </PublicLayout>
  );
}
