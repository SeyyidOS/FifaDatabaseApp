import { Languages } from "lucide-react";
import { useLang } from "../../hooks/useI18n";
import { LANGS } from "../../lib/i18n";
import { Button } from "../ui/primitives";

/** Switches between English and Turkish; shows the language in use. */
export function LanguageButton() {
  const { lang, setLang } = useLang();
  const next = LANGS.find((l) => l.value !== lang)!;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-9 gap-1.5 px-2.5"
      onClick={() => setLang(next.value)}
      aria-label={next.label}
      title={next.label}
    >
      <Languages className="size-4" />
      <span className="text-xs font-semibold">{LANGS.find((l) => l.value === lang)!.short}</span>
    </Button>
  );
}
