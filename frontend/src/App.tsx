import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PageSkeleton } from "./components/DataGate";
import { AppShell } from "./components/layout/AppShell";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const MatchCenter = lazy(() => import("./pages/MatchCenter"));
const Standings = lazy(() => import("./pages/Standings"));
const Matches = lazy(() => import("./pages/Matches"));
const Players = lazy(() => import("./pages/Players"));
const PlayerProfile = lazy(() => import("./pages/PlayerProfile"));
const HeadToHead = lazy(() => import("./pages/HeadToHead"));
const Admin = lazy(() => import("./pages/Admin"));

export default function App() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/play" element={<MatchCenter />} />
          <Route path="/leaderboard" element={<Standings />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:name" element={<PlayerProfile />} />
          <Route path="/h2h" element={<HeadToHead />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}
