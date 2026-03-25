"use client";

import { useEffect, useState } from "react";
import { Activity, Clock, Command, Route } from "lucide-react";

import { Panel, SectionHeader } from "@/src/components/primitives";

interface AutomationEntry {
  label: string;
  program: string;
  args: string[];
  schedule: string;
  nextRun: string | null;
  lastRun: string | null;
  runAtLoad: boolean;
  status: "active" | "inactive";
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatNextRun(nextRun: string | null, schedule: string): string {
  if (!nextRun) return schedule;
  if (nextRun === "interval-based") return schedule;
  const diffMs = new Date(nextRun).getTime() - Date.now();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "< 1m";
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return new Date(nextRun).toLocaleDateString();
}

function CommandBadge({ program, args }: { program: string; args: string[] }) {
  const full = args.length > 0 ? `${program} ${args.join(" ")}` : program;
  // Shorten long paths
  const short = full.length > 60 ? full.slice(0, 57) + "…" : full;
  return (
    <code className="text-xs font-mono bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground" title={full}>
      {short}
    </code>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        status === "active"
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
          : "bg-muted text-muted-foreground border border-border/60"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          status === "active" ? "bg-emerald-400" : "bg-muted-foreground/40"
        }`}
      />
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );
}

export function AutomationsClient() {
  const [automations, setAutomations] = useState<AutomationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setAutomations(data.automations ?? []);
        }
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="space-y-6">
      <SectionHeader
        title="Automations"
        description="Scheduled jobs and always-on workflows tracked alongside the mission-control shell."
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Route className="h-3.5 w-3.5" />
            <span>Source-driven ops surface</span>
          </div>
        }
      />

      <Panel
        title="Automation roster"
        description="Name, purpose, cadence, next run, status, and source/owner in one place."
      >
        {loading && (
          <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Activity className="size-4 animate-pulse" />
            Loading automations…
          </div>
        )}

        {error && (
          <div className="px-3 py-6 text-sm text-red-400">
            Failed to load automations: {error}
          </div>
        )}

        {!loading && !error && automations.length === 0 && (
          <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-8 text-sm text-muted-foreground text-center">
            No automations registered yet. Automation jobs will appear here once configured.
          </div>
        )}

        {!loading && !error && automations.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Command</th>
                  <th className="pb-2 pr-4 font-medium">Schedule</th>
                  <th className="pb-2 pr-4 font-medium">Next Run</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {automations.map((a) => (
                  <tr key={a.label} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Command className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground truncate">{a.label}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 max-w-xs">
                      <CommandBadge program={a.program} args={a.args} />
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3 shrink-0" />
                        <span className="whitespace-nowrap">{a.schedule}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground whitespace-nowrap">
                      <div className="flex flex-col">
                        <span>{formatNextRun(a.nextRun, a.schedule)}</span>
                        {a.lastRun && (
                          <span className="text-[10px] text-muted-foreground/60">
                            last {formatRelativeTime(a.lastRun)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </main>
  );
}
