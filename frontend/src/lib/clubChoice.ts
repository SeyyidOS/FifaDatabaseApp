import type { Club } from "./types";

export type ClubChoice = { kind: "club"; id: number } | { kind: "custom"; name: string } | null;

export function choiceName(choice: ClubChoice, clubs: Club[]): string {
  if (!choice) return "";
  if (choice.kind === "custom") return choice.name.trim();
  return clubs.find((c) => c.id === choice.id)?.name ?? "";
}
