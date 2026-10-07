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

export const SOURCE_SERIES = [
  { key: "favW", label: "winsFav", color: "var(--chart-2)" },
  { key: "evenW", label: "winsEven", color: "var(--win)" },
  { key: "dogW", label: "winsDog", color: "var(--accent)" },
  { key: "draws", label: "draws", color: "var(--draw)" },
  { key: "dogL", label: "lossesDog", color: "var(--text-faint)" },
  { key: "evenL", label: "lossesEven", color: "var(--chart-9)" },
  { key: "favL", label: "lossesFav", color: "var(--loss)" },
] as const satisfies readonly { key: keyof Omit<EloSourceRow, "name">; label: string; color: string }[];
