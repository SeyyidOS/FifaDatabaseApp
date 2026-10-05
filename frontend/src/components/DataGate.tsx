import type { ReactNode } from "react";
import { RefreshCw, ServerCrash } from "lucide-react";
import type { Analytics } from "../hooks/analytics-context";
import { useAnalytics } from "../hooks/useAnalytics";
import { API_URL } from "../lib/api";
import { Button, EmptyState, Skeleton } from "./ui/primitives";

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function DataGate({ children }: { children: (data: Analytics) => ReactNode }) {
  const { data, isLoading, error, refetch } = useAnalytics();
  if (data) return <>{children(data)}</>;
  if (error && !isLoading)
    return (
      <div className="card mx-auto mt-10 max-w-lg">
        <EmptyState
          icon={<ServerCrash className="size-5" />}
          title="Can't reach the match server"
          description={
            <>
              {error.message}
              <span className="mt-2 block font-mono text-xs text-faint">{API_URL}</span>
            </>
          }
          action={
            <Button variant="primary" onClick={refetch}>
              <RefreshCw className="size-4" /> Try again
            </Button>
          }
        />
      </div>
    );
  return <PageSkeleton />;
}
