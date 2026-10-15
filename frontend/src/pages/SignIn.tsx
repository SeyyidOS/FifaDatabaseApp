import { motion } from "motion/react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "../components/board/PublicLayout";
import { Field, TextInput } from "../components/ui/form";
import { Button } from "../components/ui/primitives";
import { useAccount, useAccountsEnabled } from "../hooks/useAccount";
import { useLang, useT } from "../hooks/useI18n";
import { getAccount, saveAccount, takeAfterSignIn } from "../lib/account";
import { accountApi, ApiError } from "../lib/api";
import { defineMessages } from "../lib/i18n";

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

/** /signin: ask for a link, or come back with one (?token=…). Signed in, the home page is Profilim. */
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
        navigate(takeAfterSignIn() ?? "/", { replace: true });
      })
      .catch(() => {
        // already signed in on this device: say so and stay signed in
        if (getAccount()) {
          toast.error(t("badLink"));
          navigate("/", { replace: true });
        } else setFailed(true);
      });
  }, [linkToken, navigate, t]);

  let body;
  if (linkToken && !failed) body = <p className="text-muted">{t("checking")}</p>;
  else if (account && !linkToken) return <Navigate to="/" replace />;
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
