import { useContext } from "react";
import { AnalyticsContext } from "./analytics-context";

export function useAnalytics() {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error("useAnalytics must be used inside <AnalyticsProvider>");
  return ctx;
}
