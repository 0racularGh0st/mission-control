"use client";

import { useMemo, useState } from "react";
import { Clock3, Flag, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { useTasksViewModel } from "@/src/viewmodels/useTasksViewModel";
import { cn } from "@/lib/utils";

const CURSOR_STORAGE_KEY = "mission-control.tasks.cursor";

const laneOrder = ["now", "next", "review", "blocked", "done"] as const;

function laneTone(lane: string) {
  switch (lane) {
    case "now":
      return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "next":
      return "border-violet-500/30 bg-violet-500/10 text-violet-200";
    case "review":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "blocked":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "done":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    default:
      return "border-border/70 bg-background/50 text-foreground";
  }
}

export function TasksClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });

  const { cards, lanes, summary } = useTasksViewModel(snapshot);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(cards[0]?.id ?? null);

  const selectedTask = useMemo(
    () => cards.find((task) => task.id === selectedTaskId) ?? cards[0] ?? null,
    [cards, selectedTaskId]
  );

  const groupedCards = laneOrder.map((lane) => ({
    lane,
    cards: cards.filter((card) => card.lane === lane),
  }));

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Tasks"
        description={`Trello-style queue mapped from the runtime snapshot. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport}.`}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Panel title="Total tasks"><div className="text-2xl font-semibold">{summary.totalTasksLabel}</div></Panel>
        <Panel title="Active lanes"><div className="text-2xl font-semibold">{summary.activeLanesLabel}</div></Panel>
        <Panel title="Blocked"><div className="text-2xl font-semibold">{summary.blockedTasksLabel}</div></Panel>
        <Panel title="Review"><div className="text-2xl font-semibold">{summary.reviewTasksLabel}</div></Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        {groupedCards.map(({ lane, cards: laneCards }) => {
          const laneMeta = lanes.find((item) => item.lane === lane);
          return (
            <Panel key={lane} title={laneMeta?.label ?? lane.toUpperCase()} description={`${laneMeta?.stateLabel ?? "Queue lane"} · ${laneMeta?.countLabel ?? laneCards.length} cards`} className="h-full">
              <div className="space-y-3">
                {laneCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedTaskId(card.id)}
                    className="w-full text-left"
                  >
                    <Card className="border-border/70 bg-background/55 p-4 transition hover:border-primary/40 hover:bg-background/80">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{card.title}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{card.id}</div>
                          </div>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", laneTone(card.lane))}>
                            {card.status}
                          </span>
                        </div>

                        <p className="line-clamp-2 text-sm text-muted-foreground">{card.summary}</p>

                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><UserRound className="size-3" /> {card.assignee}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><Flag className="size-3" /> {card.priority}</span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><Clock3 className="size-3" /> {card.updatedAtLabel}</span>
                        </div>
                      </div>
                    </Card>
                  </button>
                ))}
              </div>
            </Panel>
          );
        })}
      </section>

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="max-w-3xl overflow-hidden border-border/70 bg-popover p-0 sm:max-w-3xl">
          {selectedTask && (
            <div className="grid max-h-[80vh] gap-0 md:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5 overflow-y-auto p-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{selectedTask.title}</DialogTitle>
                  <DialogDescription>
                    {selectedTask.id} · {selectedTask.laneLabel} · {selectedTask.status}
                  </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                  <span className={cn("rounded-full border px-2 py-1 text-xs font-medium", laneTone(selectedTask.lane))}>{selectedTask.status}</span>
                  <span className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">Priority {selectedTask.priority}</span>
                  <span className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">Model {selectedTask.model}</span>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Why it exists</div>
                  <p className="text-sm leading-6 text-muted-foreground">{selectedTask.detail}</p>
                </div>

                {selectedTask.blockingReason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                    <div className="mb-1 font-medium">Blocked by</div>
                    <div>{selectedTask.blockingReason}</div>
                  </div>
                )}
              </div>

              <aside className="border-t border-border/60 bg-background/30 p-6 md:border-t-0 md:border-l">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</div>
                    <div className="mt-1 text-sm font-medium">{selectedTask.assignee}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Updated</div>
                    <div className="mt-1 text-sm font-medium">{selectedTask.updatedAtLabel}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">ETA</div>
                    <div className="mt-1 text-sm font-medium">{selectedTask.etaLabel}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Summary</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">{selectedTask.summary}</div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSelectedTaskId(null)}>
                    Close
                  </Button>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
