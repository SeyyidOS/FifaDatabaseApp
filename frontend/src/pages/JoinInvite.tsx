import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Check, Hourglass } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PublicLayout } from "../components/board/PublicLayout";
import { TextInput } from "../components/ui/form";
import { Avatar } from "../components/ui/Identity";
import { Button } from "../components/ui/primitives";
import { useAccount } from "../hooks/useAccount";
import { useT } from "../hooks/useI18n";
import { rememberAfterSignIn, saveAccount } from "../lib/account";
import { accountApi, ApiError } from "../lib/api";
import { displayName, nameLang } from "../lib/format";
import { defineMessages } from "../lib/i18n";
import type { InvitePreview } from "../lib/types";

const m = defineMessages({
  en: {
    invited: "You're invited",
    meta: "{players} players · {matches} matches",
    asPlayer: "You're invited as",
    matches: "Matches",
    rank: "Rank",
    newPlayer: "New",
    signIn: "Sign in to join",
    signInHint: "No password: we'll e-mail you a link and bring you back here.",
    join: "Join",
    joined: "You're in",
    whoAreYou: "Which one are you?",
    whoHint: "If you've played in this league, pick yourself: your matches and Elo come with you once an admin confirms.",
    played: "{n} matches",
    notListed: "I'm not on the list",
    yourName: "Your name in the league",
    thatsMe: "That's me · {name}",
    joinNew: "Join as {name}",
    requestedTitle: "Request sent",
    requestedText: "Once an owner or admin confirms it, your matches and Elo are on your account. You can look around meanwhile.",
    open: "Go to the league",
    gone: "This invite doesn't work any more",
    goneText: "It was used, it expired or the group link was reset. Ask whoever invited you for a new one.",
    home: "Home",
  },
  tr: {
    invited: "Davet edildin",
    meta: "{players} oyuncu · {matches} maç",
    asPlayer: "Seni bu isimle çağırdılar",
    matches: "Maç",
    rank: "Sıra",
    newPlayer: "Yeni",
    signIn: "Katılmak için giriş yap",
    signInHint: "Şifre yok: e-postana link gelir, seni buraya geri getirir.",
    join: "Katıl",
    joined: "Ligdesin",
    whoAreYou: "Sen hangisisin?",
    whoHint: "Bu ligde oynadıysan kendini seç: bir yönetici onaylayınca maçların ve Elo'n hesabına gelir.",
    played: "{n} maç",
    notListed: "Listede yokum",
    yourName: "Ligdeki adın",
    thatsMe: "Bu benim · {name}",
    joinNew: "{name} olarak katıl",
    requestedTitle: "İstek gönderildi",
    requestedText: "Sahip ya da bir yönetici onaylayınca maçların ve Elo'n hesabına bağlanır. Bu arada lige göz atabilirsin.",
    open: "Lige gir",
    gone: "Bu davet artık çalışmıyor",
    goneText: "Kullanılmış, süresi dolmuş ya da grup linki yenilenmiş. Seni davet edenden yenisini iste.",
    home: "Ana sayfa",
  },
});

function BoardCard({ preview }: { preview: InvitePreview }) {
  const t = useT(m);
  return (
    <div className="card flex items-center gap-4 p-4">
      <Avatar name={preview.board.name} size="lg" className="rounded-2xl" />
      <span className="min-w-0">
        <span lang={nameLang(preview.board.name)} className="display block truncate text-2xl">
          {preview.board.name}
        </span>
        <span className="tabular block text-xs text-muted">{t("meta", preview.board)}</span>
      </span>
    </div>
  );
}

/** /join/:code — what an invite leads to, and joining with it. */
export default function JoinInvite() {
  const t = useT(m);
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const account = useAccount();
  const preview = useQuery({ queryKey: ["invite", code], queryFn: () => accountApi.preview(code), retry: false });
  const [pick, setPick] = useState<number | "new" | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState<string | null>(null);

  const signIn = () => {
    rememberAfterSignIn(`/join/${code}`);
    navigate("/signin");
  };

  const accept = async (body: { playerId?: number; newName?: string }, playsAs: string) => {
    if (!account) return;
    setBusy(true);
    try {
      const result = await accountApi.accept(account.token, code, body);
      // an account without a name takes the one it plays under
      if (!account.user.name) {
        const user = await accountApi.rename(account.token, displayName(playsAs)).catch(() => null);
        if (user) saveAccount({ token: account.token, user });
      }
      await queryClient.invalidateQueries({ queryKey: ["auth-boards"] });
      if (result.status === "requested") setRequested(result.slug);
      else {
        toast.success(t("joined"));
        navigate(`/b/${result.slug}`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (preview.isLoading) body = <div className="skeleton h-40" />;
  else if (!preview.data)
    body = (
      <div className="space-y-3">
        <h1 className="display text-4xl">{t("gone")}</h1>
        <p className="text-muted">{t("goneText")}</p>
        <Link to="/" className="text-sm font-semibold text-accent-text hover:underline">
          {t("home")}
        </Link>
      </div>
    );
  else if (requested)
    body = (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <span className="grid size-14 place-items-center rounded-2xl border border-team-b/40 bg-team-b/10 text-team-b">
          <Hourglass className="size-7" />
        </span>
        <h1 className="display text-4xl">{t("requestedTitle")}</h1>
        <p className="text-muted">{t("requestedText")}</p>
        <Link to={`/b/${requested}`} className="accent-gem flex h-12 items-center justify-center rounded-xl font-bold">
          {t("open")}
        </Link>
      </motion.div>
    );
  else {
    const p = preview.data;
    const picked = p.players?.find((pl) => pl.id === pick)?.name;
    const cta = !account ? (
      <div className="space-y-2">
        <button onClick={signIn} className="accent-gem flex h-12 w-full items-center justify-center rounded-xl font-bold">
          {t("signIn")}
        </button>
        <p className="text-center text-xs text-muted">{t("signInHint")}</p>
      </div>
    ) : null;

    body = (
      <div className="space-y-5">
        <p className="label text-accent-text">{t("invited")}</p>
        <BoardCard preview={p} />
        {p.kind === "personal" && p.player ? (
          <>
            <div className="card flex flex-col items-center gap-3 p-6 text-center">
              <span className="label">{t("asPlayer")}</span>
              <Avatar name={p.player.name} size="xl" ring="accent" />
              <span lang={nameLang(p.player.name)} className="display text-4xl">
                {displayName(p.player.name)}
              </span>
              <div className="tabular grid w-full grid-cols-3 gap-2">
                {[
                  [t("matches"), p.player.played],
                  ["Elo", p.player.elo],
                  [t("rank"), p.player.rank ? `${p.player.rank}.` : t("newPlayer")],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-line bg-surface-2/50 p-3">
                    <p className="label">{label}</p>
                    <p className="display mt-1 text-2xl">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            {cta ?? (
              <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={() => accept({}, p.player!.name)}>
                {t("join")}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="display text-4xl">{t("whoAreYou")}</h1>
              <p className="text-sm text-muted">{t("whoHint")}</p>
            </div>
            {cta ?? (
              <>
                <div role="radiogroup" className="space-y-2">
                  {(p.players ?? []).map((pl) => (
                    <button
                      key={pl.id}
                      role="radio"
                      aria-checked={pick === pl.id}
                      onClick={() => setPick(pl.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                        pick === pl.id ? "border-accent/60 bg-accent/[0.07]" : "border-line bg-surface hover:border-line-strong"
                      }`}
                    >
                      <Avatar name={pl.name} size="md" />
                      <span className="flex-1">
                        <span className="block font-semibold">{displayName(pl.name)}</span>
                        <span className="tabular block text-xs text-muted">{t("played", { n: pl.played })}</span>
                      </span>
                      {pick === pl.id && <Check className="size-5 text-accent-text" />}
                    </button>
                  ))}
                  <button
                    role="radio"
                    aria-checked={pick === "new"}
                    onClick={() => setPick("new")}
                    className={`w-full rounded-2xl border border-dashed px-4 py-3 text-left text-sm font-semibold ${
                      pick === "new" ? "border-accent/60 text-fg" : "border-line text-muted"
                    }`}
                  >
                    {t("notListed")}
                  </button>
                  {pick === "new" && (
                    <TextInput
                      autoFocus
                      maxLength={30}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={t("yourName")}
                      aria-label={t("yourName")}
                    />
                  )}
                </div>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  loading={busy}
                  disabled={pick === null || (pick === "new" && !newName.trim())}
                  onClick={() =>
                    pick === "new" ? accept({ newName: newName.trim() }, newName.trim()) : accept({ playerId: pick ?? undefined }, picked ?? "")
                  }
                >
                  {pick === "new" ? t("joinNew", { name: newName.trim() || "…" }) : t("thatsMe", { name: displayName(picked ?? "…") })}
                </Button>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-md py-6 sm:py-12">{body}</div>
    </PublicLayout>
  );
}
