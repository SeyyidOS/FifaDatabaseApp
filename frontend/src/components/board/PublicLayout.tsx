import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../layout/Logo";
import { LanguageButton } from "../layout/LanguageButton";
import { ThemeButton } from "../layout/ThemeButton";

/** Pages outside a board: the board list and the sign-in screen. */
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
        </span>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">{children}</main>
    </div>
  );
}
