import { AnimatePresence, motion } from "motion/react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, UserPlus, X } from "lucide-react";
import { useAddPlayer } from "../hooks/useData";
import { cn } from "../lib/cn";
import { displayName } from "../lib/format";
import type { Player } from "../lib/types";
import { Button } from "./ui/primitives";

export function AddPlayer({
  players,
  className,
  onAdded,
}: {
  players: Player[];
  className?: string;
  onAdded?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const add = useAddPlayer();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().toLowerCase();
    if (!n) return;
    if (players.some((p) => p.name.toLowerCase() === n)) {
      toast.error(`${displayName(n)} is already on the roster`);
      return;
    }
    try {
      await add.mutateAsync(n);
      toast.success(`${displayName(n)} joined the squad`, { description: "Starting rating: 1000 Elo" });
      setName("");
      setOpen(false);
      onAdded?.(n);
    } catch (err) {
      toast.error("Couldn't add player", { description: (err as Error).message });
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
              placeholder="Player name"
              maxLength={100}
              className="input h-9 w-40"
            />
            <Button type="submit" size="icon" variant="primary" loading={add.isPending} aria-label="Add">
              {!add.isPending && <Check className="size-4" />}
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Cancel">
              <X className="size-4" />
            </Button>
          </motion.form>
        ) : (
          <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)} className="h-9">
              <UserPlus className="size-4" /> Add player
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
