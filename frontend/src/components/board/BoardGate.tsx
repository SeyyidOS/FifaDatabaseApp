import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AnalyticsProvider } from "../../hooks/AnalyticsProvider";
import { BoardContext, type BoardContextValue } from "../../hooks/board-context";
import { useAccount, useMemberships } from "../../hooks/useAccount";
import { useSessions } from "../../hooks/useBoard";
import { useMe } from "../../hooks/useData";
import { accountApi, boardApi } from "../../lib/api";
import { saveSession, updateSession, type BoardSession } from "../../lib/session";
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
const NightRecap = lazy(() => import("../../pages/NightRecap"));

/** Keeps this device's label for the board in step when an admin renames it elsewhere. */
function SessionSync({ slug, name }: { slug: string; name: string }) {
  const me = useMe();
  useEffect(() => {
    if (me.data && me.data.name !== name) updateSession(slug, { name: me.data.name });
  }, [me.data, name, slug]);
  return null;
}

/**
 * A board the signed-in account is a member of opens without its password: the account trades its
 * membership for a board token. An owner or admin who came in with the board password moves up to
 * their own role the same way. True while that is still being worked out.
 */
function useAccountEntry(slug: string, session: BoardSession | undefined) {
  const account = useAccount();
  const memberships = useMemberships();
  const membership = memberships.data?.find((mb) => mb.slug === slug);
  const member = !!membership;
  const upgrade = !!session && session.role === "member" && !!membership && membership.role !== "player";
  const signedIn = !!session;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if ((signedIn && !upgrade) || !account || !member) return;
    let cancelled = false;
    accountApi
      .session(account.token, slug)
      .then((signIn) => !cancelled && saveSession(signIn, true, account.user.id))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [signedIn, upgrade, account, member, slug]);
  return !signedIn && !failed && (memberships.isLoading || member);
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
            viaAccount: session.viaAccount !== undefined,
          }
        : null,
    [slug, session],
  );

  const entering = useAccountEntry(slug, session);
  if (!board && entering) return <PageSkeleton />;
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
              <Route path="night/:key" element={<NightRecap />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to={board.path()} replace />} />
            </Routes>
          </Suspense>
        </AppShell>
      </AnalyticsProvider>
    </BoardContext.Provider>
  );
}
