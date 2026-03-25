import { AgentsClient } from "@/src/components/AgentsClient";
import { AgentActivityClient } from "@/src/components/AgentActivityClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export default async function AgentsPage() {
  const runtime = await getDashboardRuntimeState();

  return (
    <>
      <AgentsClient initialRuntime={runtime} />
      <div className="mt-6">
        <AgentActivityClient />
      </div>
    </>
  );
}
