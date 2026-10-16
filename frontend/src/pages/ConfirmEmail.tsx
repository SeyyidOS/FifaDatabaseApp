import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "../components/board/PublicLayout";
import { useT } from "../hooks/useI18n";
import { saveAccount } from "../lib/account";
import { accountApi } from "../lib/api";
import { defineMessages } from "../lib/i18n";

const m = defineMessages({
  en: {
    checking: "Checking the link…",
    done: "You now sign in with {email}",
    bad: "This link doesn't work",
    badText: "It was used, it expired (after 15 minutes) or a newer one was sent. Ask for a new one on your profile.",
    home: "Home",
  },
  tr: {
    checking: "Link kontrol ediliyor…",
    done: "Artık {email} ile giriş yapıyorsun",
    bad: "Bu link çalışmıyor",
    badText: "Kullanılmış, süresi dolmuş (15 dakika) ya da daha yenisi gönderilmiş. Profilinden yenisini iste.",
    home: "Ana sayfa",
  },
});

// a link works once: the effect below may run twice in development, so both runs share one request
const confirming = new Map<string, ReturnType<typeof accountApi.confirmEmail>>();

/** /email?token=…: the link mailed to a new address; opening it moves the account there and signs in here. */
export default function ConfirmEmail() {
  const t = useT(m);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [failed, setFailed] = useState(!token);

  useEffect(() => {
    if (!token) return;
    let request = confirming.get(token);
    if (!request) confirming.set(token, (request = accountApi.confirmEmail(token)));
    request
      .then((session) => {
        saveAccount(session);
        toast.success(t("done", { email: session.user.email }));
        // the token is spent: keep it out of the address bar and the history
        navigate("/", { replace: true });
      })
      .catch(() => setFailed(true));
  }, [token, navigate, t]);

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md py-8 sm:py-14">
        {failed ? (
          <div className="space-y-3">
            <h1 className="display text-4xl">{t("bad")}</h1>
            <p className="text-muted">{t("badText")}</p>
            <Link to="/" className="text-sm font-semibold text-accent-text hover:underline">
              {t("home")}
            </Link>
          </div>
        ) : (
          <p className="text-muted">{t("checking")}</p>
        )}
      </div>
    </PublicLayout>
  );
}
