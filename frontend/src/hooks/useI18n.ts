import { useMemo, useSyncExternalStore } from "react";
import { getLang, setLang, subscribeLang, translator, type Messages } from "../lib/i18n";

export function useLang() {
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang);
  return { lang, setLang };
}

/** Translate with a module's messages; re-renders when the language changes. */
export function useT<T extends Record<string, string>>(messages: Messages<T>) {
  const { lang } = useLang();
  return useMemo(() => translator(messages, lang), [messages, lang]);
}
