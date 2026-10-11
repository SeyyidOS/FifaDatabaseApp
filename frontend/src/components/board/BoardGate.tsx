import { lazy, Suspense, useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AnalyticsProvider } from "../../hooks/AnalyticsProvider";
import { BoardContext, type BoardContextValue } from "../../hooks/board-context";
import { useSessions } from "../../hooks/useBoard";
import { useMe } from "../../hooks/useData";
import { boardApi } from "../../lib/api";
import { updateSession } from "../../lib/session";
import { PageSkeleton } from "../DataGate";
import { AppShell } from "../layout/AppShell";
import { BoardSignIn } from "./BoardSignIn";
import { PublicLayout } from "./PublicLayout";

const Dashboard = lazy(() => import("../../pages/Dashboard"));
const MatchCenter = lazy(() => import("../../pages/MatchCenter"));
const Standings = lazy(() => import("../../pages/Standings"));
const Matches = lazy(() => import("../../pages/Matches"));
const Players = lazy(() => import("../../pages/Players"));
const PlayerProfile = lazy(() => import("../../pages/PlayerProfile"));
const HeadToHead = lazy(() => import("../../pages/HeadToHead"));
const Settings = lazy(() => import("../../pages/Settings"));
const Clubs = lazy(() => import("../../pages/Clubs"));
const ClubProfile = lazy(() => import("../../pages/ClubProfile"));
const Insights = lazy(() => import("../../pages/Insights"));
// temporary: the 10 October 2026 night report
const NightRecap = lazy(() => import("../../pages/NightRecap"));

/** Keeps this device's label for the board in step when an admin renames it elsewhere. */
function SessionSync({ slug, name }: { slug: string; name: string }) {
  const me = useMe();
  useEffect(() => {
    if (me.data && me.data.name !== name) updateSession(slug, { name: me.data.name });
  }, [me.data, name, slug]);
  return null;
}

/** /b/:slug/* — the board's pages once this device is signed in, its sign-in screen before. */
export default function BoardGate() {
  const { slug = "" } = useParams();
  const session = useSessions().find((s) => s.slug === slug);

  const board = useMemo<BoardContextValue | null>(
    () =>
      session
        ? {
            slug,
            name: session.name,
            role: session.role,
            token: session.token,
            api: boardApi(slug, session.token),
            path: (to = "") => `/b/${slug}${to}`,
          }
        : null,
    [slug, session],
  );

  if (!board)
    return (
      <PublicLayout>
        <BoardSignIn slug={slug} />
      </PublicLayout>
    );

  return (
    <BoardContext.Provider value={board}>
      <AnalyticsProvider>
        <SessionSync slug={slug} name={board.name} />
        <AppShell>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route index element={<Dashboard />} />
              <Route path="play" element={<MatchCenter />} />
              <Route path="leaderboard" element={<Standings />} />
              <Route path="matches" element={<Matches />} />
              <Route path="players" element={<Players />} />
              <Route path="players/:name" element={<PlayerProfile />} />
              <Route path="h2h" element={<HeadToHead />} />
              <Route path="clubs" element={<Clubs />} />
              <Route path="clubs/:club" element={<ClubProfile />} />
              <Route path="insights" element={<Insights />} />
              <Route path="night" element={<NightRecap />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to={board.path()} replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </AnalyticsProvider>
    </BoardContext.Provider>
  );
}
