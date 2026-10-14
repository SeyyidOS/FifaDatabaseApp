import { motion } from "motion/react";
import { ArrowLeft, LogOut, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "../components/board/PublicLayout";
import { Avatar } from "../components/ui/Identity";
import { Field, TextInput } from "../components/ui/form";
import { Button } from "../components/ui/primitives";
import { useAccount, useAccountsEnabled } from "../hooks/useAccount";
import { useLang, useT } from "../hooks/useI18n";
import { getAccount, saveAccount, signOutAccount } from "../lib/account";
import { accountApi, ApiError } from "../lib/api";
import { defineMessages } from "../lib/i18n";
import type { Account } from "../lib/types";

const m = defineMessages({
  en: {
    eyebrow: "Your account",
    title: "No password, just a link",
    lead: "Enter your e-mail and we'll send you a sign-in link. Tap it and you're in.",
    email: "E-mail",
    send: "Send sign-in link",
    sentTitle: "Check your inbox",
    sentText: "We sent a link to {email}. It works once, for 15 minutes.",
    another: "Use another address",
    checking: "Signing you in…",
    welcome: "You're signed in",
    badLink: "This link didn't work",
    badLinkText: "Sign-in links work once and only for 15 minutes. Ask for a new one below.",
    off: "Accounts aren't open yet",
    offText: "For now, boards are joined with their password.",
    signedInAs: "Signed in as",
    name: "Your name",
    nameHint: "What others see once boards use accounts.",
    save: "Save",
    saved: "Saved",
    signOut: "Sign out",
    boards: "Back to boards",
  },
  tr: {
    eyebrow: "Hesabın",
    title: "Şifre yok, link var",
    lead: "E-postanı yaz, giriş linkini gönderelim. Linke dokununca içeridesin.",
    email: "E-posta",
    send: "Giriş linkini gönder",
    sentTitle: "Gelen kutuna bak",
    sentText: "Linki {email} adresine gönderdik. Bir kez ve 15 dakika geçerli.",
    another: "Başka bir adres dene",
    checking: "Giriş yapılıyor…",
    welcome: "Giriş yaptın",
    badLink: "Bu link çalışmadı",
    badLinkText: "Giriş linkleri bir kez ve sadece 15 dakika geçerli. Aşağıdan yenisini iste.",
    off: "Hesaplar henüz açık değil",
    offText: "Şimdilik board'lara şifreyle giriliyor.",
    signedInAs: "Giriş yapan",
    name: "Adın",
    nameHint: "Board'lar hesaplarla çalışmaya başlayınca diğerleri bunu görecek.",
    save: "Kaydet",
    saved: "Kaydedildi",
    signOut: "Çıkış yap",
    boards: "Board'lara dön",
  },
});

// a link works once: the effect below may run twice in development, so both runs share one request
const verifying = new Map<string, ReturnType<typeof accountApi.verify>>();

function LinkForm() {
  const t = useT(m);
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await accountApi.requestLink(email.trim(), lang);
      setSentTo(email.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (sentTo)
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <span className="grid size-14 place-items-center rounded-2xl border border-win/35 bg-win/10 text-win">
          <MailCheck className="size-7" />
        </span>
        <h1 className="display text-4xl">{t("sentTitle")}</h1>
        <p className="text-muted">{t("sentText", { email: sentTo })}</p>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setSentTo(null)}>
          {t("another")}
        </Button>
      </motion.div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t("email")} htmlFor="signin-email" error={error}>
        <TextInput
          id="signin-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
        />
      </Field>
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="accent-gem flex h-12 w-full items-center justify-center rounded-xl text-base font-bold transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {t("send")}
      </button>
    </form>
  );
}

function SignedIn({ token, user }: { token: string; user: Account }) {
  const t = useT(m);
  const [name, setName] = useState(user.name ?? "");
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      saveAccount({ token, user: await accountApi.rename(token, name) });
      toast.success(t("saved"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) signOutAccount();
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4 p-4">
        <Avatar name={user.name || user.email} size="lg" />
        <span className="min-w-0 flex-1">
          <span className="label block">{t("signedInAs")}</span>
          <span className="block truncate font-semibold">{user.name || user.email}</span>
          {user.name && <span className="block truncate text-sm text-muted">{user.email}</span>}
        </span>
      </div>
      <form onSubmit={save} className="space-y-3">
        <Field label={t("name")} hint={t("nameHint")} htmlFor="account-name">
          <TextInput id="account-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" loading={busy} disabled={!name.trim() || name.trim() === user.name}>
          {t("save")}
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
          <ArrowLeft className="size-4" /> {t("boards")}
        </Link>
        <Button variant="danger" onClick={signOutAccount}>
          <LogOut className="size-4" /> {t("signOut")}
        </Button>
      </div>
    </div>
  );
}

/** /signin: ask for a link, come back with one (?token=…), or see who is signed in. */
export default function SignIn() {
  const t = useT(m);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const linkToken = params.get("token");
  const enabled = useAccountsEnabled();
  const account = useAccount();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!linkToken) return;
    let request = verifying.get(linkToken);
    if (!request) verifying.set(linkToken, (request = accountApi.verify(linkToken)));
    request
      .then((session) => {
        saveAccount(session);
        toast.success(t("welcome"));
        // the token is spent: keep it out of the address bar and the history
        navigate("/signin", { replace: true });
      })
      .catch(() => {
        // already signed in on this device: say so and stay signed in
        if (getAccount()) {
          toast.error(t("badLink"));
          navigate("/signin", { replace: true });
        } else setFailed(true);
      });
  }, [linkToken, navigate, t]);

  let body;
  if (linkToken && !failed) body = <p className="text-muted">{t("checking")}</p>;
  else if (account && !linkToken) body = <SignedIn token={account.token} user={account.user} />;
  else if (!enabled && !linkToken)
    body = (
      <div className="space-y-3">
        <h1 className="display text-4xl">{t("off")}</h1>
        <p className="text-muted">{t("offText")}</p>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text hover:underline">
          <ArrowLeft className="size-4" /> {t("boards")}
        </Link>
      </div>
    );
  else
    body = (
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="label text-accent-text">{failed ? t("badLink") : t("eyebrow")}</p>
          <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="text-muted">{failed ? t("badLinkText") : t("lead")}</p>
        </div>
        <LinkForm />
      </div>
    );

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md py-8 sm:py-14">{body}</div>
    </PublicLayout>
  );
}
