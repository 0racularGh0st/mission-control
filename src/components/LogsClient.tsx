"use client";

import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";

const CURSOR_STORAGE_KEY = "mission-control.logs.cursor";

export function LogsClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Logs"
        description={`Runtime-backed logs stream scaffold. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport} · poll: ${runtimeMeta.recommendedPollMs}ms.`}
      />
      <Panel title="Recent runtime events" description="Shared runtime layer (snapshot + polling metadata).">
        <div className="space-y-2 font-mono text-xs">
          {snapshot.recentLogs.map((entry) => (
            <div key={entry.id} className="rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
              {entry.message}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
