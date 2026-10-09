import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PageSkeleton } from "./components/DataGate";
import { ThemedToaster } from "./components/layout/ThemedToaster";

/** The board that data from before boards existed was moved into (backend/migrations.py). */
const LEGACY_BOARD = "main";

const Home = lazy(() => import("./pages/Home"));
const BoardGate = lazy(() => import("./components/board/BoardGate"));

/** Links from before boards existed (#/leaderboard, #/admin, …) belong to the original group's board. */
function LegacyRedirect() {
  const { pathname, search } = useLocation();
  const page = pathname === "/admin" ? "/settings" : pathname;
  return <Navigate to={`/b/${LEGACY_BOARD}${page}${search}`} replace />;
}

export default function App() {
  return (
    <>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/b/:slug/*" element={<BoardGate />} />
          <Route path="*" element={<LegacyRedirect />} />
        </Routes>
      </Suspense>
      <ThemedToaster />
    </>
  );
}
