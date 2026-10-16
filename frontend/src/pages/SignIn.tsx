import { motion } from "motion/react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
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
    title: "No password, just a code",
    lead: "Enter your e-mail and we'll send you a six-digit code. Type it here and you're in.",
    email: "E-mail",
    send: "Send me a code",
    sentTitle: "Check your inbox",
    sentText: "We sent a code to {email}. Type it here; it works once, for 15 minutes.",
    code: "Code",
    enter: "Sign in",
    orLink: "Or tap the link in the same e-mail to sign in in the browser it opens.",
    wrongCode: "That code didn't work: it's wrong, used, or older than 15 minutes.",
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
    title: "Şifre yok, kod var",
    lead: "E-postanı yaz, 6 haneli bir kod gönderelim. Kodu buraya yazınca içeridesin.",
    email: "E-posta",
    send: "Kodu gönder",
    sentTitle: "Gelen kutuna bak",
    sentText: "Kodu {email} adresine gönderdik. Buraya yaz; bir kez ve 15 dakika geçerli.",
    code: "Kod",
    enter: "Giriş yap",
    orLink: "Ya da aynı e-postadaki linke dokun: açıldığı tarayıcıda giriş yaparsın.",
    wrongCode: "Bu kod olmadı: yanlış, kullanılmış ya da 15 dakikadan eski.",
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

/** The code from the e-mail, typed here: it signs in this browser or home-screen app, wherever the e-mail opened. */
function CodeForm({ email }: { email: string }) {
  const t = useT(m);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef<string | null>(null);

  const enter = async (value: string) => {
    if (value.length !== 6 || busy) return;
    tried.current = value;
    setBusy(true);
    setError(null);
    try {
      saveAccount(await accountApi.verifyCode(email, value));
      toast.success(t("welcome"));
      navigate(takeAfterSignIn() ?? "/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 400 ? t("wrongCode") : (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        enter(code);
      }}
      className="space-y-3"
    >
      <Field label={t("code")} htmlFor="signin-code" error={error}>
        <TextInput
          id="signin-code"
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            // six digits (typed, pasted or filled in from the e-mail): in we go, once per code
            if (digits.length === 6 && digits !== tried.current) enter(digits);
          }}
          className="tabular h-14 text-center text-2xl font-bold tracking-[0.5em]"
          placeholder="••••••"
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>
        {t("enter")}
      </Button>
    </form>
  );
}

/** Asks for the e-mail (under `header`); once sent, the code takes the whole screen. */
function LinkForm({ header }: { header: ReactNode }) {
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
        <CodeForm email={sentTo} />
        <p className="text-xs text-muted">{t("orLink")}</p>
        <Button variant="ghost" className="w-full" onClick={() => setSentTo(null)}>
          {t("another")}
        </Button>
      </motion.div>
    );

  return (
    <div className="space-y-6">
      {header}
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
    </div>
  );
}

/** /signin: ask for a code (and a link), type the code, or come back with the link (?token=…). Signed in,
 * the home page is Profilim. */
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
      <LinkForm
        header={
          <div className="space-y-3">
            <p className="label text-accent-text">{failed ? t("badLink") : t("eyebrow")}</p>
            <h1 className="display text-4xl sm:text-5xl">{t("title")}</h1>
            <p className="text-muted">{failed ? t("badLinkText") : t("lead")}</p>
          </div>
        }
      />
    );

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md py-8 sm:py-14">{body}</div>
    </PublicLayout>
  );
}
