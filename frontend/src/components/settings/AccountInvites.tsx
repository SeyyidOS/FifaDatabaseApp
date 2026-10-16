import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, PartyPopper, RefreshCw, Send, UserCheck, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "../../hooks/useAccount";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useBoard } from "../../hooks/useBoard";
import { useT } from "../../hooks/useI18n";
import { accountApi, ApiError, inviteLink } from "../../lib/api";
import { cn } from "../../lib/cn";
import { displayName } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import type { Membership } from "../../lib/types";
import { Avatar } from "../ui/Identity";
import { Button, Panel, Pill } from "../ui/primitives";

const m = defineMessages({
  en: {
    invite: "Invite",
    inviteSub: "Whoever opens a link signs in with their own account",
    readyBold: "Your league is ready.",
    readyText: " Share the group link in your group chat: everyone picks who they are and you confirm it.",
    group: "Group link",
    groupHint: "One link for the group chat. People pick who they are and you confirm it.",
    makeGroup: "Make a group link",
    reset: "New link",
    resetDone: "New group link: the old one no longer works",
    personal: "Personal links",
    personalHint: "A link for one player: it goes straight to them, no approval. One use, a week.",
    everyoneIn: "Everyone who plays here has an account.",
    noPlayersYet: "No players yet. Whoever comes by the group link picks “I'm not on the list” and joins with their name.",
    played: "{n} matches",
    send: "Invite",
    copyAgain: "Copy link",
    copied: "Link copied",
    shareText: "Join {board} on Matchnight",
    members: "Members",
    membersSub: "People in the league with an account",
    requests: "Waiting for you",
    wantsToBe: "Says they are {player}",
    newPlayer: "New player: {name}",
    approve: "Confirm",
    reject: "Decline",
    owner: "Owner",
    admin: "Admin",
    player: "Player",
    makeAdmin: "Make admin",
    makePlayer: "Make player",
    remove: "Remove {name}",
    noName: "No name yet",
  },
  tr: {
    invite: "Davet et",
    inviteSub: "Linki açan kendi hesabıyla giriş yapar",
    readyBold: "Ligin hazır.",
    readyText: " Grup linkini arkadaş grubuna at: herkes kendini seçer, sen onaylarsın.",
    group: "Grup linki",
    groupHint: "Grup sohbeti için tek link. Gelen kendini seçer, sen onaylarsın.",
    makeGroup: "Grup linki oluştur",
    reset: "Yeni link",
    resetDone: "Yeni grup linki: eskisi artık çalışmıyor",
    personal: "Kişiye özel linkler",
    personalHint: "Tek bir oyuncu için link: doğrudan ona bağlanır, onay gerekmez. Bir kez, bir hafta geçerli.",
    everyoneIn: "Burada oynayan herkesin hesabı var.",
    noPlayersYet: "Henüz oyuncu yok. Grup linkiyle gelen “Listede yokum” der ve adıyla katılır.",
    played: "{n} maç",
    send: "Davet et",
    copyAgain: "Linki kopyala",
    copied: "Link kopyalandı",
    shareText: "{board} ligine Matchnight'ta katıl",
    members: "Üyeler",
    membersSub: "Ligde hesabıyla olanlar",
    requests: "Seni bekleyenler",
    wantsToBe: "{player} olduğunu söylüyor",
    newPlayer: "Yeni oyuncu: {name}",
    approve: "Onayla",
    reject: "Reddet",
    owner: "Sahip",
    admin: "Yönetici",
    player: "Oyuncu",
    makeAdmin: "Yönetici yap",
    makePlayer: "Oyuncu yap",
    remove: "Çıkar: {name}",
    noName: "Henüz adı yok",
  },
});

const failed = (err: unknown) => toast.error(err instanceof ApiError ? err.message : String(err));

/** Hands a link over: the phone's share sheet where there is one, the clipboard otherwise. */
async function hand(link: string, text: string, copied: string) {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text, url: link });
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
    }
  }
  await navigator.clipboard.writeText(link);
  toast.success(copied);
}

/** Group link and personal links, for owners and admins once accounts are on. */
export function AccountInvites({ welcome }: { welcome: boolean }) {
  const t = useT(m);
  const { slug, name } = useBoard();
  const account = useAccount()!;
  const qc = useQueryClient();
  const invites = useQuery({ queryKey: ["invites", slug], queryFn: () => accountApi.invites(account.token, slug) });
  const [sent, setSent] = useState<number | null>(null);
  const text = t("shareText", { board: name });
  const empty = useAnalytics().data?.players.length === 0;

  const group = async (reset = false) => {
    try {
      const made = reset ? await accountApi.resetGroupInvite(account.token, slug) : await accountApi.invite(account.token, slug);
      await qc.invalidateQueries({ queryKey: ["invites", slug] });
      if (reset) toast.success(t("resetDone"));
      else await hand(inviteLink(made.code), text, t("copied"));
    } catch (err) {
      failed(err);
    }
  };

  const personal = async (playerId: number) => {
    try {
      const made = await accountApi.invite(account.token, slug, playerId);
      await hand(inviteLink(made.code), text, t("copied"));
      setSent(playerId);
      qc.invalidateQueries({ queryKey: ["invites", slug] });
    } catch (err) {
      failed(err);
    }
  };

  const data = invites.data;
  return (
    <Panel
      title={t("invite")}
      subtitle={t("inviteSub")}
      icon={<Link2 className="size-4" />}
      className={cn(welcome && "ring-2 ring-accent/60")}
      bodyClassName="space-y-6 p-5"
    >
      {welcome && (
        <div className="flex gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-4 text-sm">
          <PartyPopper className="size-5 shrink-0 text-accent-text" />
          <p>
            <span className="font-semibold">{t("readyBold")}</span>
            {t("readyText")}
          </p>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("group")}</p>
        <p className="text-xs text-muted">{t("groupHint")}</p>
        {data?.group ? (
          <div className="flex gap-2">
            <input readOnly value={inviteLink(data.group)} onFocus={(e) => e.target.select()} className="input h-11 font-mono text-xs" />
            <Button variant="primary" className="h-11" onClick={() => hand(inviteLink(data.group!), text, t("copied"))} aria-label={t("copyAgain")}>
              <Send className="size-4" />
            </Button>
            <Button variant="secondary" className="h-11" onClick={() => group(true)} aria-label={t("reset")} title={t("reset")}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={() => group()} disabled={!data}>
            <Link2 className="size-4" /> {t("makeGroup")}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">{t("personal")}</p>
        <p className="text-xs text-muted">{t("personalHint")}</p>
        {data && !data.players.length && <p className="text-sm text-muted">{empty ? t("noPlayersYet") : t("everyoneIn")}</p>}
        {!!data?.players.length && (
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {data.players.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={p.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{displayName(p.name)}</span>
                  <span className="tabular block text-xs text-muted">{t("played", { n: p.played })}</span>
                </span>
                <Button variant={p.code ? "secondary" : "outline"} size="sm" onClick={() => personal(p.id)}>
                  {sent === p.id ? <Check className="size-3.5 text-win" /> : p.code ? <Copy className="size-3.5" /> : <Send className="size-3.5" />}
                  {p.code ? t("copyAgain") : t("send")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** Join requests to confirm, and who has an account here; the owner also makes admins. */
export function Members({ role }: { role: Membership["role"] }) {
  const t = useT(m);
  const { slug } = useBoard();
  const account = useAccount()!;
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ["members", slug], queryFn: () => accountApi.members(account.token, slug) });

  const act = async (run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (err) {
      failed(err);
    }
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["members", slug] }),
      qc.invalidateQueries({ queryKey: ["invites", slug] }),
      qc.invalidateQueries({ queryKey: ["auth-boards"] }),
      qc.invalidateQueries({ queryKey: ["board", slug] }),
    ]);
  };

  const data = members.data;
  return (
    <Panel title={t("members")} subtitle={t("membersSub")} icon={<Users className="size-4" />} bodyClassName="space-y-5 p-5">
      {!!data?.requests.length && (
        <div className="space-y-2">
          <p className="label text-team-b">{t("requests")}</p>
          {data.requests.map((r) => {
            const claim = displayName(r.player?.name ?? r.newName ?? "");
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-team-b/35 bg-team-b/[0.07] px-3 py-2.5">
                <UserCheck className="size-4 shrink-0 text-team-b" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {r.player ? t("wantsToBe", { player: claim }) : t("newPlayer", { name: claim })}
                  </span>
                  {/* who is asking: the e-mail is what the claim can be checked against */}
                  <span className="block truncate text-xs text-muted">{r.name && r.name !== claim ? `${r.name} · ${r.email}` : r.email}</span>
                </span>
                <span className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => act(() => accountApi.approve(account.token, slug, r.id))}>
                    {t("approve")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => act(() => accountApi.reject(account.token, slug, r.id))}>
                    {t("reject")}
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      )}
      <ul className="space-y-1">
        {data?.members.map((mb) => {
          const canRemove = mb.role !== "owner" && (role === "owner" || mb.role === "player") && mb.userId !== account.user.id;
          return (
            <li key={mb.userId} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar name={mb.name || "?"} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{mb.name || t("noName")}</span>
                {/* the player they are, when it isn't already their name */}
                {mb.player && displayName(mb.player.name) !== mb.name && (
                  <span className="block truncate text-xs text-muted">{displayName(mb.player.name)}</span>
                )}
              </span>
              <Pill tone={mb.role === "owner" ? "accent" : "neutral"}>{t(mb.role)}</Pill>
              {role === "owner" && mb.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => act(() => accountApi.setRole(account.token, slug, mb.userId, mb.role === "admin" ? "player" : "admin"))}
                >
                  {mb.role === "admin" ? t("makePlayer") : t("makeAdmin")}
                </Button>
              )}
              {canRemove && (
                <button
                  onClick={() => act(() => accountApi.removeMember(account.token, slug, mb.userId))}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-2 hover:text-loss"
                  aria-label={t("remove", { name: mb.name || "?" })}
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
