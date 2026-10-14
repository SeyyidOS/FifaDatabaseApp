import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccount, useAccountsEnabled } from "../../hooks/useAccount";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";
import { Logo } from "../layout/Logo";
import { LanguageButton } from "../layout/LanguageButton";
import { ThemeButton } from "../layout/ThemeButton";
import { Avatar } from "../ui/Identity";

const m = defineMessages({
  en: { signIn: "Sign in", account: "Your account" },
  tr: { signIn: "Giriş yap", account: "Hesabın" },
});

/** The account signed in on this device, or a way to sign in; only once the server offers accounts. */
function AccountChip() {
  const t = useT(m);
  const enabled = useAccountsEnabled();
  const account = useAccount();
  if (!enabled && !account) return null;
  return account ? (
    <Link
      to="/signin"
      aria-label={t("account")}
      className="ml-1 flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold hover:bg-surface-2"
    >
      <Avatar name={account.user.name || account.user.email} size="sm" />
      <span className="max-w-32 truncate max-sm:hidden">{account.user.name || account.user.email}</span>
    </Link>
  ) : (
    <Link
      to="/signin"
      className="ml-1 flex min-h-10 items-center rounded-xl border border-line px-3 text-sm font-semibold hover:border-line-strong"
    >
      {t("signIn")}
    </Link>
  );
}

/** Pages outside a board: the board list and the sign-in screens. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="app-ambient" />
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/">
          <Logo />
        </Link>
        <span className="flex items-center">
          <LanguageButton />
          <ThemeButton />
          <AccountChip />
        </span>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
