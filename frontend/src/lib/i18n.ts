/**
 * Tiny i18n: each module declares its own English and Turkish strings next to the code that uses
 * them (defineMessages), and TypeScript makes sure every English key has a Turkish one.
 *
 * Strings may contain {placeholders}; "one|many" picks a form by the {n} variable.
 */
export type Lang = "en" | "tr";

export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "tr", label: "Türkçe", short: "TR" },
];

const KEY = "fm-lang";
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "tr") return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("tr") ? "tr" : "en";
}

let current: Lang = detect();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const getLang = () => current;
/** BCP 47 locale for Intl formatters. */
export const locale = (lang: Lang = current) => (lang === "tr" ? "tr-TR" : "en-GB");

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

export function subscribeLang(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type Vars = Record<string, string | number>;
export type Messages<T extends Record<string, string>> = { en: T; tr: { [K in keyof T]: string } };

export const defineMessages = <T extends Record<string, string>>(messages: Messages<T>) => messages;

export function format(template: string, vars?: Vars): string {
  let text = template;
  if (text.includes("|")) {
    const [one, many] = text.split("|");
    text = Number(vars?.n) === 1 ? one : many;
  }
  return text.replace(/\{(\w+)\}/g, (match, k: string) => (vars && k in vars ? String(vars[k]) : match));
}

export type Translate<T> = (key: keyof T & string, vars?: Vars) => string;

export function translator<T extends Record<string, string>>(messages: Messages<T>, lang: Lang = current): Translate<T> {
  return (key, vars) => format(messages[lang][key] ?? messages.en[key], vars);
}
