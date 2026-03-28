import { DashboardClient } from "@/src/components/DashboardClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";
import { getRecentEvents } from "@/src/server/timeline";
import { getApprovals } from "@/src/server/approvals";
import { getRetries } from "@/src/server/retries";
import { getMemoryStats } from "@/src/server/memoryScanner";
import { getTasks } from "@/src/runtime/tasks/store";
import type { TaskLaneCounts } from "@/src/components/TasksWidget";

export default async function Home() {
  const runtime = await getDashboardRuntimeState();
  const recentTimelineEvents = getRecentEvents(5);
  const approvalsData = getApprovals({ status: "pending", limit: 1 });
  const retriesData = getRetries({ status: "failed", limit: 1 });
  const memoryStats = getMemoryStats();

  // Compute task lane counts from the store
  const allTasks = getTasks();
  const taskLaneCounts: TaskLaneCounts = { now: 0, next: 0, review: 0, blocked: 0, done: 0 };
  for (const task of allTasks) {
    if (task.lane in taskLaneCounts) {
      taskLaneCounts[task.lane]++;
    }
  }

  return (
    <DashboardClient
      initialRuntime={runtime}
      recentTimelineEvents={recentTimelineEvents}
      approvalsPendingCount={approvalsData.pendingCount}
      approvalsOldest={approvalsData.approvals[0] ?? null}
      retriesFailedCount={retriesData.failedCount}
      retriesMostRecent={retriesData.retries[0] ?? null}
      memoryStats={memoryStats}
      taskLaneCounts={taskLaneCounts}
    />
  );
}
