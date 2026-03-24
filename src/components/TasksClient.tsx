"use client";

import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { useTasksViewModel } from "@/src/viewmodels/useTasksViewModel";

const CURSOR_STORAGE_KEY = "mission-control.tasks.cursor";

export function TasksClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });

  const { lanes, summary } = useTasksViewModel(snapshot);

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Tasks"
        description={`Runtime-backed task lanes. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport}.`}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel title="Running">
          <div className="text-2xl font-semibold">{summary.runningTasksLabel}</div>
        </Panel>
        <Panel title="Blocked">
          <div className="text-2xl font-semibold">{summary.blockedTasksLabel}</div>
        </Panel>
        <Panel title="Waiting review">
          <div className="text-2xl font-semibold">{summary.waitingReviewLabel}</div>
        </Panel>
      </section>

      <Panel title="Queue lanes" description="Shared runtime snapshot mapped through a page-level view model.">
        <div className="space-y-2 text-sm">
          {lanes.map((lane) => (
            <div key={lane.lane} className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-md border border-border/60 bg-background/35 px-3 py-2">
              <div>
                <div className="font-medium text-foreground">{lane.label}</div>
                <div className="text-muted-foreground">{lane.stateLabel}</div>
              </div>
              <div className="text-muted-foreground">{lane.countLabel}</div>
              <div className="text-muted-foreground">{lane.etaLabel}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
