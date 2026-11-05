import { UserPlus } from "lucide-react";
import { useBoard } from "../../hooks/useBoard";
import { useT } from "../../hooks/useI18n";
import { defineMessages } from "../../lib/i18n";
import { Button } from "../ui/primitives";
import { BoardLink } from "./BoardLink";

const m = defineMessages({
  en: { invite: "Invite players" },
  tr: { invite: "Oyuncu davet et" },
});

/**
 * Where players come from: an invite, sent from Settings, where owners and admins can also add someone by name
 * who can't come in with one. Nobody else puts names on the roster, so for them this is nothing.
 */
export function InviteButton() {
  const t = useT(m);
  const { role } = useBoard();
  if (role !== "admin") return null;
  return (
    <BoardLink to="/settings">
      <Button size="sm" variant="secondary" className="h-9">
        <UserPlus className="size-4" /> {t("invite")}
      </Button>
    </BoardLink>
  );
}
