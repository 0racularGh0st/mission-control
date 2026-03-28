import { DashboardClient } from "@/src/components/DashboardClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";
import { getRecentEvents } from "@/src/server/timeline";
import { getApprovals } from "@/src/server/approvals";
import { getRetries } from "@/src/server/retries";

export default async function Home() {
  const runtime = await getDashboardRuntimeState();
  const recentTimelineEvents = getRecentEvents(5);
  const approvalsData = getApprovals({ status: "pending", limit: 1 });
  const retriesData = getRetries({ status: "failed", limit: 1 });

  return (
    <DashboardClient
      initialRuntime={runtime}
      recentTimelineEvents={recentTimelineEvents}
      approvalsPendingCount={approvalsData.pendingCount}
      approvalsOldest={approvalsData.approvals[0] ?? null}
      retriesFailedCount={retriesData.failedCount}
      retriesMostRecent={retriesData.retries[0] ?? null}
    />
  );
}
