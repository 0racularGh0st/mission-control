import { Panel, SectionHeader } from "@/src/components/primitives";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export default async function LogsPage() {
  const runtime = await getDashboardRuntimeState();
  const logs = runtime.snapshot.recentLogs;

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Logs"
        description={`Runtime-backed logs stream scaffold. Source: ${runtime.source} · transport: ${runtime.transport} · poll: ${runtime.recommendedPollMs}ms.`}
      />
      <Panel title="Recent runtime events" description="Shared runtime layer (snapshot + polling metadata).">
        <div className="space-y-2 font-mono text-xs">
          {logs.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
              {entry.message}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
