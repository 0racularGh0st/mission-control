import { TasksClient } from "@/src/components/TasksClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export default async function TasksPage() {
  const runtime = await getDashboardRuntimeState();

  return <TasksClient initialRuntime={runtime} />;
}
