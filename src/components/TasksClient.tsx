"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Flag, Plus, Trash2, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { useTasksViewModel } from "@/src/viewmodels/useTasksViewModel";
import type { Task, TaskLane } from "@/src/runtime/tasks/store";
import { cn } from "@/lib/utils";

const CURSOR_STORAGE_KEY = "mission-control.tasks.cursor";
const laneOrder: TaskLane[] = ["now", "next", "review", "blocked", "done"];

function laneTone(lane: string) {
  switch (lane) {
    case "now": return "border-sky-500/30 bg-sky-500/10 text-sky-200";
    case "next": return "border-violet-500/30 bg-violet-500/10 text-violet-200";
    case "review": return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "blocked": return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "done": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    default: return "border-border/70 bg-background/50 text-foreground";
  }
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1m ago";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function TaskDetailActions({ task, onClose, onRefresh }: { task: Task; onClose: () => void; onRefresh: () => void }) {
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleMove(lane: TaskLane) {
    setMoving(true);
    try {
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, action: "move", lane }),
      });
      onRefresh();
      onClose();
    } finally {
      setMoving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${task.title}"?`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/tasks?id=${task.id}`, { method: "DELETE" });
      onRefresh();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {laneOrder.filter((l) => l !== task.lane).map((lane) => (
        <Button key={lane} variant="outline" size="sm" onClick={() => handleMove(lane)} disabled={moving}>
          Move to {lane}
        </Button>
      ))}
      <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting} className="ml-auto">
        <Trash2 className="mr-1 size-3" /> Delete
      </Button>
    </div>
  );
}

function CreateTaskDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("Jarvis");
  const [priority, setPriority] = useState("P2");
  const [lane, setLane] = useState<TaskLane>("next");
  const [summary, setSummary] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assignee,
          priority,
          lane,
          status: lane === "now" ? "in progress" : lane === "review" ? "awaiting review" : lane === "done" ? "done" : lane === "blocked" ? "blocked" : "queued",
          summary,
          detail: summary,
          model: "MiniMax-M2.7",
          etaMinutes: null,
        }),
      });
      setTitle("");
      setSummary("");
      onCreated();
      onClose();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-border/70 bg-popover sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Create a new task in the queue.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title..." className="mt-1" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Assignee</label>
              <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <Input value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Lane</label>
            <Input value={lane} onChange={(e) => setLane(e.target.value as TaskLane)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Summary</label>
            <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Brief summary..." className="mt-1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={creating || !title.trim()}>{creating ? "Creating..." : "Create"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TasksClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({ initialRuntime, cursorStorageKey: CURSOR_STORAGE_KEY });
  const { cards, lanes, summary } = useTasksViewModel(snapshot);
  const [liveTasks, setLiveTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchTasks() {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setLiveTasks(data.tasks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTasks(); }, []);

  // Connect to task SSE stream for live updates
  useEffect(() => {
    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      source = new EventSource("/api/tasks/stream");

      source.addEventListener("snapshot", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { tasks: Task[] };
        setLiveTasks(payload.tasks ?? []);
        setLoading(false);
      });

      source.addEventListener("task.created", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { task: Task };
        setLiveTasks((prev) => {
          if (prev.find((t) => t.id === payload.task.id)) return prev;
          return [...prev, payload.task];
        });
      });

      source.addEventListener("task.updated", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { task: Task };
        setLiveTasks((prev) => prev.map((t) => (t.id === payload.task.id ? payload.task : t)));
      });

      source.addEventListener("task.moved", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { task: Task };
        setLiveTasks((prev) => prev.map((t) => (t.id === payload.task.id ? payload.task : t)));
      });

      source.addEventListener("task.deleted", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as { taskId: string };
        setLiveTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
      });

      source.addEventListener("error", () => {
        source?.close();
        reconnectTimer = setTimeout(connect, 3000);
      });
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      source?.close();
    };
  }, []);

  const selectedTask = useMemo(
    () => selectedTaskId !== null ? (liveTasks.find((t) => t.id === selectedTaskId) ?? null) : null,
    [liveTasks, selectedTaskId]
  );

  // Use live tasks when available, fall back to viewmodel cards
  const displayTasks = liveTasks.length > 0 ? liveTasks : cards;

  const groupedCards = laneOrder.map((lane) => ({
    lane,
    cards: displayTasks.filter((task) => task.lane === lane),
  }));

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Tasks"
        description={`Live task queue. Source: ${runtimeMeta.source} · ${runtimeMeta.transport}.`}
        action={
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 size-4" /> New Task
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Panel title="Total tasks"><div className="text-2xl font-semibold">{summary.totalTasksLabel}</div></Panel>
        <Panel title="Active lanes"><div className="text-2xl font-semibold">{summary.activeLanesLabel}</div></Panel>
        <Panel title="Blocked"><div className="text-2xl font-semibold">{summary.blockedTasksLabel}</div></Panel>
        <Panel title="Review"><div className="text-2xl font-semibold">{summary.reviewTasksLabel}</div></Panel>
        <Panel title="Done"><div className="text-2xl font-semibold">{String(displayTasks.filter(t => t.lane === "done").length)}</div></Panel>
      </section>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading tasks...</div>
      ) : (
        <section className="overflow-x-auto -mx-4 px-4">
          <div className="grid gap-4 xl:grid-cols-5" style={{ minWidth: "1200px" }}>
          {groupedCards.map(({ lane, cards: laneCards }) => {
            const laneMeta = lanes.find((item) => item.lane === lane);
            return (
              <Panel
                key={lane}
                title={laneMeta?.label ?? lane.toUpperCase()}
                description={`${laneCards.length} card${laneCards.length !== 1 ? "s" : ""}`}
                className="h-full min-w-[240px]"
              >
                <div className="space-y-3">
                  {laneCards.map((card) => (
                    <button key={card.id} type="button" onClick={() => setSelectedTaskId(card.id)} className="w-full text-left">
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
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1"><Clock3 className="size-3" /> {formatRelativeTime(card.updatedAt)}</span>
                          </div>
                        </div>
                      </Card>
                    </button>
                  ))}
                </div>
              </Panel>
            );
          })}
          </div>
        </section>
      )}

      <Dialog open={Boolean(selectedTask)} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <DialogContent className="max-w-3xl overflow-hidden border-border/70 bg-popover p-0 sm:max-w-3xl">
          {selectedTask && (
            <div className="grid max-h-[80vh] gap-0 md:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-5 overflow-y-auto p-6">
                <DialogHeader>
                  <DialogTitle className="text-2xl">{selectedTask.title}</DialogTitle>
                  <DialogDescription>{selectedTask.id} · {selectedTask.lane.toUpperCase()} · {selectedTask.status}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                  <span className={cn("rounded-full border px-2 py-1 text-xs font-medium", laneTone(selectedTask.lane))}>{selectedTask.status}</span>
                  <span className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">Priority {selectedTask.priority}</span>
                  <span className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">Model {selectedTask.model}</span>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Summary</div>
                  <p className="text-sm leading-6 text-muted-foreground">{selectedTask.summary || selectedTask.detail}</p>
                </div>

                {selectedTask.blockingReason && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                    <div className="mb-1 font-medium">Blocked by</div>
                    <div>{selectedTask.blockingReason}</div>
                  </div>
                )}

                <TaskDetailActions task={selectedTask} onClose={() => setSelectedTaskId(null)} onRefresh={fetchTasks} />
              </div>

              <aside className="border-t border-border/60 bg-background/30 p-6 md:border-t-0 md:border-l">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Assignee</div>
                    <div className="mt-1 text-sm font-medium">{selectedTask.assignee}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Updated</div>
                    <div className="mt-1 text-sm font-medium">{formatRelativeTime(selectedTask.updatedAt)}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">ETA</div>
                    <div className="mt-1 text-sm font-medium">{selectedTask.etaMinutes ? `~${selectedTask.etaMinutes}m` : "unknown"}</div>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => setSelectedTaskId(null)}>Close</Button>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CreateTaskDialog open={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchTasks} />
    </div>
  );
}
