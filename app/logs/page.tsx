import { LogsClient } from "@/src/components/LogsClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export default async function LogsPage() {
  const runtime = await getDashboardRuntimeState();

  return <LogsClient initialRuntime={runtime} />;
}
