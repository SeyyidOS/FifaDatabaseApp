import {
  CalendarDays,
  Gamepad2,
  LayoutDashboard,
  Settings,
  Sparkles,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { defineMessages } from "../../lib/i18n";

export const navMessages = defineMessages({
  en: {
    overview: "Overview",
    overviewShort: "Home",
    overviewDesc: "Season pulse, form and records",
    play: "Match Center",
    playShort: "Play",
    playDesc: "Draft teams, pick clubs, log results",
    standings: "Standings",
    standingsShort: "Table",
    standingsDesc: "Players, clubs and duos",
    matches: "Matches",
    matchesShort: "Matches",
    matchesDesc: "Every result, night by night",
    players: "Players",
    playersShort: "Players",
    playersDesc: "Profiles, ratings and rivalries",
    h2h: "Head to Head",
    h2hShort: "H2H",
    h2hDesc: "Compare any two players",
    insights: "Insights",
    insightsShort: "Insights",
    insightsDesc: "Awards, Elo DNA and duo matchups",
    settings: "Settings",
    settingsShort: "Settings",
    settingsDesc: "Invite friends, passwords, players and matches",
  },
  tr: {
    overview: "Genel Bakış",
    overviewShort: "Özet",
    overviewDesc: "Sezonun nabzı, form ve rekorlar",
    play: "Maç Merkezi",
    playShort: "Oyna",
    playDesc: "Takım kur, kulüp seç, sonucu gir",
    standings: "Puan Durumu",
    standingsShort: "Tablo",
    standingsDesc: "Oyuncular, kulüpler ve ikililer",
    matches: "Maçlar",
    matchesShort: "Maçlar",
    matchesDesc: "Gece gece bütün sonuçlar",
    players: "Oyuncular",
    playersShort: "Oyuncular",
    playersDesc: "Profiller, puanlar ve rekabetler",
    h2h: "Karşılaştır",
    h2hShort: "Kıyas",
    h2hDesc: "İki oyuncuyu karşılaştır",
    insights: "Analiz",
    insightsShort: "Analiz",
    insightsDesc: "Ödüller, Elo DNA'sı ve ikili eşleşmeler",
    settings: "Ayarlar",
    settingsShort: "Ayarlar",
    settingsDesc: "Arkadaş davet et, şifreler, oyuncular ve maçlar",
  },
});

type NavKey = "overview" | "play" | "standings" | "matches" | "players" | "h2h" | "insights" | "settings";

export interface NavItem {
  /** Path inside the board ("" is the board's overview). */
  to: string;
  key: NavKey;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: "", key: "overview", icon: LayoutDashboard },
  { to: "/play", key: "play", icon: Gamepad2 },
  { to: "/leaderboard", key: "standings", icon: Trophy },
  { to: "/matches", key: "matches", icon: CalendarDays },
  { to: "/players", key: "players", icon: Users },
  { to: "/h2h", key: "h2h", icon: Swords },
  { to: "/insights", key: "insights", icon: Sparkles },
  { to: "/settings", key: "settings", icon: Settings },
];
