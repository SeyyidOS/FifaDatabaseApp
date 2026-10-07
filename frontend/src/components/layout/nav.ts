import {
  CalendarDays,
  Gamepad2,
  LayoutDashboard,
  Settings,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Path inside the board ("" is the board's overview). */
  to: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
}

export const NAV: NavItem[] = [
  { to: "", label: "Overview", short: "Home", icon: LayoutDashboard, description: "Season pulse, form and records" },
  { to: "/play", label: "Match Center", short: "Play", icon: Gamepad2, description: "Draft teams, pick clubs, log results" },
  { to: "/leaderboard", label: "Standings", short: "Table", icon: Trophy, description: "Players, clubs and duos" },
  { to: "/matches", label: "Matches", short: "Matches", icon: CalendarDays, description: "Every result, night by night" },
  { to: "/players", label: "Players", short: "Players", icon: Users, description: "Profiles, ratings and rivalries" },
  { to: "/h2h", label: "Head to Head", short: "H2H", icon: Swords, description: "Compare any two players" },
  { to: "/settings", label: "Settings", short: "Settings", icon: Settings, description: "Invite friends, passwords, players and matches" },
];
