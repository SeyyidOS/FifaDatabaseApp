import { Moon, Sun } from "lucide-react";
import { useT } from "../../hooks/useI18n";
import { useTheme } from "../../hooks/useTheme";
import { common } from "../../lib/messages";
import { Button } from "../ui/primitives";

export function ThemeButton() {
  const t = useT(common);
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("toggleTheme")}>
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </Button>
  );
}
