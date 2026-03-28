import { DashboardClient } from "@/src/components/DashboardClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";
import { getRecentEvents } from "@/src/server/timeline";

export default async function Home() {
  const runtime = await getDashboardRuntimeState();
  const recentTimelineEvents = getRecentEvents(5);

  return <DashboardClient initialRuntime={runtime} recentTimelineEvents={recentTimelineEvents} />;
}
