import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Link2, Lock, SearchX } from "lucide-react";
import { useAccount } from "../../hooks/useAccount";
import { rememberAfterSignIn } from "../../lib/account";
import { ApiError, publicApi } from "../../lib/api";
import type { BoardPublic } from "../../lib/types";
import { saveSession } from "../../lib/session";
import { Avatar } from "../ui/Identity";
import { Checkbox, Field, PasswordInput } from "../ui/form";
import { Button, EmptyState, Skeleton } from "../ui/primitives";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";
import { common } from "../../lib/messages";

const m = defineMessages({
  en: {
    asAdmin: "Signed in as admin",
    welcome: "Welcome to {name}",
    wrong: "Wrong password",
    missing: "No board with that code",
    missingHint: "Check the link or code (“{slug}”) with whoever invited you.",
    unreachable: "Can't reach the server",
    private: "Private board",
    prompt: "Enter the board password your group shared with you.",
    password: "Password",
    remember: "Remember this device",
    rememberHint: "Stay signed in here; turn off on shared computers.",
    enter: "Enter board",
    inviteOnly: "Invite-only league",
    signInPrompt: "Members come in with their account.",
    signIn: "Sign in",
    notMember: "You're not in this league yet. Ask whoever runs it for an invite link.",
    myLeagues: "My leagues",
  },
  tr: {
    asAdmin: "Yönetici olarak giriş yapıldı",
    welcome: "{name} board'una hoş geldin",
    wrong: "Şifre yanlış",
    missing: "Bu kodla bir board yok",
    missingHint: "Linki ya da kodu (“{slug}”) seni davet eden kişiyle kontrol et.",
    unreachable: "Sunucuya ulaşılamıyor",
    private: "Özel board",
    prompt: "Grubunun seninle paylaştığı board şifresini gir.",
    password: "Şifre",
    remember: "Bu cihazı hatırla",
    rememberHint: "Burada girişli kal; ortak bilgisayarlarda kapat.",
    enter: "Board'a gir",
    inviteOnly: "Yalnızca davetle",
    signInPrompt: "Üyeler kendi hesaplarıyla girer.",
    signIn: "Giriş yap",
    notMember: "Henüz bu ligde değilsin. Ligi yöneten kişiden davet linki iste.",
    myLeagues: "Liglerim",
  },
});

/** A league started with an account has no password: members get in with the account, others with an invite. */
function InviteOnly({ board }: { board: BoardPublic }) {
  const t = useT(m);
  const account = useAccount();
  const navigate = useNavigate();
  const signIn = () => {
    rememberAfterSignIn(`/b/${board.slug}`);
    navigate("/signin");
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mx-auto mt-6 flex max-w-md flex-col items-center p-7 text-center sm:mt-14 sm:p-9"
    >
      <Avatar name={board.name} size="xl" className="rounded-3xl" />
      <p className="label mt-5 flex items-center gap-1.5">
        <Link2 className="size-3" /> {t("inviteOnly")}
      </p>
      <h1 className="display mt-2 text-4xl">{board.name}</h1>
      {account ? (
        <>
          <p className="mt-3 text-sm text-muted">{t("notMember")}</p>
          <Link to="/" className="mt-7 w-full">
            <Button variant="secondary" size="lg" className="w-full">
              {t("myLeagues")}
            </Button>
          </Link>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">{t("signInPrompt")}</p>
          <Button variant="primary" size="lg" className="mt-7 w-full" onClick={signIn}>
            {t("signIn")}
          </Button>
        </>
      )}
    </motion.div>
  );
}

export function BoardSignIn({ slug }: { slug: string }) {
  const t = useT(m);
  const tc = useT(common);
  const info = useQuery({ queryKey: ["board-info", slug], queryFn: () => publicApi.board(slug), retry: false });
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const signIn = await publicApi.signIn(slug, password);
      saveSession(signIn, remember);
      toast.success(t("welcome", { name: signIn.name }), {
        description: signIn.role === "admin" ? t("asAdmin") : undefined,
      });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t("wrong") : (err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  if (info.error) {
    const missing = info.error instanceof ApiError && info.error.status === 404;
    return (
      <div className="card mx-auto mt-10 max-w-md">
        <EmptyState
          icon={<SearchX className="size-5" />}
          title={missing ? t("missing") : t("unreachable")}
          description={missing ? t("missingHint", { slug }) : info.error.message}
          action={
            <Link to="/">
              <Button variant="secondary">
                <ArrowLeft className="size-4" /> {tc("allBoards")}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (info.data && !info.data.passwordLogin) return <InviteOnly board={info.data} />;

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card mx-auto mt-6 max-w-md p-7 sm:mt-14 sm:p-9"
    >
      <div className="flex flex-col items-center text-center">
        {info.data ? (
          <Avatar name={info.data.name} size="xl" className="rounded-3xl" />
        ) : (
          <Skeleton className="size-20 rounded-3xl" />
        )}
        <p className="label mt-5 flex items-center gap-1.5">
          <Lock className="size-3" /> {t("private")}
        </p>
        <h1 className="display mt-2 text-4xl">{info.data?.name ?? " "}</h1>
        <p className="mt-2 text-sm text-muted">{t("prompt")}</p>
      </div>
      <div className="mt-7 space-y-4">
        <Field label={t("password")} htmlFor="board-password" error={error}>
          <PasswordInput
            id="board-password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Checkbox checked={remember} onChange={setRemember}>
          {t("remember")}
          <span className="block text-xs text-faint">{t("rememberHint")}</span>
        </Checkbox>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!password}>
          {t("enter")}
        </Button>
      </div>
      <Link to="/" className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted hover:text-fg">
        <ArrowLeft className="size-3.5" /> {tc("allBoards")}
      </Link>
    </motion.form>
  );
}
