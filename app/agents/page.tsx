import { AgentsClient } from "@/src/components/AgentsClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export default async function AgentsPage() {
  const runtime = await getDashboardRuntimeState();

  return <AgentsClient initialRuntime={runtime} />;
}
