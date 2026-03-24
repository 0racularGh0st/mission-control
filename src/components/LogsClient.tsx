"use client";

import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { useLogsViewModel } from "@/src/viewmodels/useLogsViewModel";

const CURSOR_STORAGE_KEY = "mission-control.logs.cursor";

export function LogsClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });
  const { lines, countLabel, hasLines } = useLogsViewModel(snapshot);

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Logs"
        description={`Runtime-backed logs stream scaffold. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport} · poll: ${runtimeMeta.recommendedPollMs}ms.`}
      />
      <Panel
        title="Recent runtime events"
        description={`Shared runtime layer (snapshot + polling metadata). Showing ${countLabel} event${countLabel === "1" ? "" : "s"}.`}
      >
        {hasLines ? (
          <div className="space-y-2 font-mono text-xs">
            {lines.map((line) => (
              <div key={line.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
                <span className="text-[11px] text-muted-foreground/80">{line.timestampLabel}</span>
                <span>{line.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-xs text-muted-foreground">
            No runtime events yet. New logs will appear here as the runtime emits updates.
          </div>
        )}
      </Panel>
    </div>
  );
}
