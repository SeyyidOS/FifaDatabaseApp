import { AnimatePresence, motion } from "motion/react";
import { LayoutGrid, LogOut, UserRound } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAccount, useMemberships } from "../../hooks/useAccount";
import { useBoard } from "../../hooks/useBoard";
import { useT } from "../../hooks/useI18n";
import { signOutAccount } from "../../lib/account";
import { cn } from "../../lib/cn";
import { nameLang } from "../../lib/format";
import { defineMessages } from "../../lib/i18n";
import { LanguageButton } from "../layout/LanguageButton";
import { ThemeButton } from "../layout/ThemeButton";
import { Avatar } from "../ui/Identity";

const m = defineMessages({
  en: {
    account: "Your account",
    myPlayer: "My player profile",
    leagues: "My leagues",
    signOut: "Sign out",
    owner: "owner",
    admin: "admin",
    player: "player",
    privacy: "Privacy",
  },
  tr: {
    account: "Hesabın",
    myPlayer: "Oyuncu profilim",
    leagues: "Liglerim",
    signOut: "Çıkış yap",
    owner: "sahip",
    admin: "yönetici",
    player: "oyuncu",
    privacy: "Gizlilik",
  },
});

/**
 * The signed-in account inside a league: who you are here, a way to your player and your leagues, and
 * signing out. A sheet from the bottom on phones (with language and theme, which the sidebar has on
 * larger screens), a dropdown under the avatar there.
 */
export function AccountMenu() {
  const t = useT(m);
  const account = useAccount();
  const { slug, name, path } = useBoard();
  const membership = useMemberships().data?.find((mb) => mb.slug === slug);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  // where the dropdown hangs on larger screens; null on phones, where it is a sheet
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!account) return null;
  const label = account.user.name || account.user.email;
  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setAnchor(window.matchMedia("(min-width: 1024px)").matches ? { top: r.bottom + 8, right: window.innerWidth - r.right } : null);
    setOpen((o) => !o);
  };
  const signOut = () => {
    signOutAccount();
    navigate("/");
  };

  const item = "flex min-h-[52px] w-full items-center gap-3.5 rounded-2xl px-3 text-left text-[15px] font-semibold transition-colors hover:bg-surface-2 lg:min-h-11 lg:text-sm";
  const icon = "grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 lg:size-8";
  return (
    <>
      <button onClick={toggle} aria-label={t("account")} aria-expanded={open} className="rounded-full">
        <Avatar name={label} photo={account.user.photo} size="md" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-50">
              <motion.div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-label={t("account")}
                style={anchor ?? undefined}
                className="card absolute inset-x-2.5 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] rounded-[28px] p-2 pt-3 shadow-2xl lg:inset-x-auto lg:bottom-auto lg:w-80 lg:rounded-3xl lg:pt-4"
                initial={{ opacity: 0, y: anchor ? -6 : 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: anchor ? -4 : 16 }}
                transition={{ type: "spring", bounce: 0.12, duration: 0.4 }}
              >
                <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-line-strong lg:hidden" />
                <div className="flex items-center gap-3.5 px-3 pb-4">
                  <Avatar name={label} photo={account.user.photo} size="lg" />
                  <span className="min-w-0">
                    <span lang={nameLang(label)} className="display block truncate text-2xl">
                      {label}
                    </span>
                    <span className="block truncate text-sm text-muted">
                      {membership ? `${name} · ${t(membership.role)}` : account.user.email}
                    </span>
                  </span>
                </div>
                <div className="border-t border-line pt-1.5">
                  {membership?.player && (
                    <Link to={path(`/players/${encodeURIComponent(membership.player.name)}`)} className={item}>
                      <span className={icon}>
                        <UserRound className="size-[18px] text-accent-text" />
                      </span>
                      {t("myPlayer")}
                    </Link>
                  )}
                  <Link to="/" className={item}>
                    <span className={icon}>
                      <LayoutGrid className="size-[18px]" />
                    </span>
                    {t("leagues")}
                  </Link>
                  <button onClick={signOut} className={cn(item, "text-loss")}>
                    <span className={icon}>
                      <LogOut className="size-[18px]" />
                    </span>
                    {t("signOut")}
                  </button>
                </div>
                <div className="mt-1.5 flex items-center border-t border-line pt-1.5">
                  <Link to="/privacy" className="px-3 py-2 text-xs text-faint hover:text-muted">
                    {t("privacy")}
                  </Link>
                  <span className="ml-auto flex items-center lg:hidden">
                    <LanguageButton />
                    <ThemeButton />
                  </span>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
