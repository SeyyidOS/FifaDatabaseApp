/** The Elo-source categories, in stacking order, with their legend labels and colours. */
export interface EloSourceRow {
  name: string;
  favW: number;
  evenW: number;
  dogW: number;
  draws: number;
  dogL: number;
  evenL: number;
  favL: number;
}

export const SOURCE_SERIES: { key: keyof Omit<EloSourceRow, "name">; label: string; color: string }[] = [
  { key: "favW", label: "Wins as favourite", color: "var(--chart-2)" },
  { key: "evenW", label: "Wins in coin flips", color: "var(--win)" },
  { key: "dogW", label: "Wins as underdog", color: "var(--accent)" },
  { key: "draws", label: "Draws", color: "var(--draw)" },
  { key: "dogL", label: "Losses as underdog", color: "var(--text-faint)" },
  { key: "evenL", label: "Losses in coin flips", color: "var(--chart-9)" },
  { key: "favL", label: "Losses as favourite", color: "var(--loss)" },
];
