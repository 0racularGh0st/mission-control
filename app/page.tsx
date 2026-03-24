import { DashboardClient } from "@/src/components/DashboardClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export default async function Home() {
  const runtime = await getDashboardRuntimeState();

  return <DashboardClient initialRuntime={runtime} />;
}
