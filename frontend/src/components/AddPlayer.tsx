import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, UserPlus, X } from "lucide-react";
import { useAddPlayer } from "../hooks/useData";
import { cn } from "../lib/cn";
import { displayName } from "../lib/format";
import type { Player } from "../lib/types";
import { Button } from "./ui/primitives";
import { useT } from "../hooks/useI18n";
import { defineMessages } from "../lib/i18n";
import { common } from "../lib/messages";

const m = defineMessages({
  en: {
    badName: "Use letters and numbers",
    badNameHint: "Spaces, dots, dashes and apostrophes are fine too.",
    archived: "{name} is archived",
    archivedHint: "An admin can restore them in Settings.",
    exists: "{name} is already on the roster",
    joined: "{name} joined the squad",
    joinedHint: "Starting rating: 1000 Elo",
    failed: "Couldn't add player",
    placeholder: "Player name",
    add: "Add",
    addPlayer: "Add player",
  },
  tr: {
    badName: "Harf ve rakam kullan",
    badNameHint: "Boşluk, nokta, tire ve kesme işareti de olur.",
    archived: "{name} arşivde",
    archivedHint: "Bir yönetici Ayarlar'dan geri alabilir.",
    exists: "{name} zaten kadroda",
    joined: "{name} kadroya katıldı",
    joinedHint: "Başlangıç puanı: 1000 Elo",
    failed: "Oyuncu eklenemedi",
    placeholder: "Oyuncu adı",
    add: "Ekle",
    addPlayer: "Oyuncu ekle",
  },
});

export function AddPlayer({
  players,
  className,
  onAdded,
}: {
  players: Player[];
  className?: string;
  onAdded?: (name: string) => void;
}) {
  const t = useT(m);
  const tc = useT(common);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const add = useAddPlayer();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
    if (!n) return;
    // same rule as the API (backend/schemas.py); "&" joins the names of a duo
    if (!/^[\p{L}\p{N}_][\p{L}\p{N}_ .'-]*$/u.test(n)) {
      toast.error(t("badName"), { description: t("badNameHint") });
      return;
    }
    const existing = players.find((p) => p.name.toLowerCase() === n);
    if (existing) {
      toast.error(
        existing.archived ? t("archived", { name: displayName(n) }) : t("exists", { name: displayName(n) }),
        existing.archived ? { description: t("archivedHint") } : undefined,
      );
      return;
    }
    try {
      await add.mutateAsync(n);
      toast.success(t("joined", { name: displayName(n) }), { description: t("joinedHint") });
      setName("");
      setOpen(false);
      onAdded?.(n);
    } catch (err) {
      toast.error(t("failed"), { description: (err as Error).message });
    }
  };

  return (
    <div className={cn("relative", className)}>
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="flex items-center gap-1.5"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              placeholder={t("placeholder")}
              maxLength={30}
              className="input h-9 w-40"
            />
            <Button type="submit" size="icon" variant="primary" loading={add.isPending} aria-label={t("add")}>
              {!add.isPending && <Check className="size-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label={tc("cancel")}>
              <X className="size-4" />
            </Button>
          </motion.form>
        ) : (
          <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="h-9">
              <UserPlus className="size-4" /> {t("addPlayer")}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
