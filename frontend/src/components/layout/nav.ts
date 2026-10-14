import {
  CalendarDays,
  Gamepad2,
  LayoutDashboard,
  Settings,
  Shield,
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
    clubs: "Clubs",
    clubsShort: "Clubs",
    clubsDesc: "Club ratings, squads and comparisons",
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
    clubs: "Kulüpler",
    clubsShort: "Kulüpler",
    clubsDesc: "Kulüp puanları, kadrolar ve karşılaştırma",
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

type NavKey = "overview" | "play" | "standings" | "clubs" | "matches" | "players" | "h2h" | "insights" | "settings";

export interface NavItem {
  /** Path inside the board ("" is the board's overview). */
  to: string;
  key: NavKey;
  icon: LucideIcon;
  /**
   * tab: one of the four main tabs. play: the match center, the main action between them.
   * more: pages one level down. settings: the board's settings.
   */
  group: "tab" | "play" | "more" | "settings";
}

/** Every page, in the order the command palette lists them. */
export const NAV: NavItem[] = [
  { to: "", key: "overview", icon: LayoutDashboard, group: "tab" },
  { to: "/play", key: "play", icon: Gamepad2, group: "play" },
  { to: "/leaderboard", key: "standings", icon: Trophy, group: "tab" },
  { to: "/clubs", key: "clubs", icon: Shield, group: "more" },
  { to: "/matches", key: "matches", icon: CalendarDays, group: "tab" },
  { to: "/players", key: "players", icon: Users, group: "tab" },
  { to: "/h2h", key: "h2h", icon: Swords, group: "more" },
  { to: "/insights", key: "insights", icon: Sparkles, group: "more" },
  { to: "/settings", key: "settings", icon: Settings, group: "settings" },
];

export const navGroup = (group: NavItem["group"]) => NAV.filter((n) => n.group === group);
