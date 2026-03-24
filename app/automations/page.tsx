import { Clock3, Database, PlayCircle, RefreshCw, Route, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Panel, SectionHeader } from "@/src/components/primitives";

const automations = [
  {
    name: "Obsidian daily linker",
    purpose: "Link daily notes into the long-term memory graph and surface fresh context for review.",
    frequency: "Daily at noon",
    nextRun: "Today · 12:00",
    status: "Scheduled",
    source: "local cron · memory pipeline",
    owner: "Cody / mission-control",
    icon: RefreshCw,
  },
  {
    name: "Heartbeat digest",
    purpose: "Batch inbox, calendar, and watchlist checks into a single operator-friendly pulse.",
    frequency: "Every 30 minutes",
    nextRun: "In 18 min",
    status: "Healthy",
    source: "OpenClaw heartbeat",
    owner: "Jarvis",
    icon: Clock3,
  },
  {
    name: "Runtime snapshot sync",
    purpose: "Persist current dashboard state so the control surface reloads with continuity.",
    frequency: "On change + hourly",
    nextRun: "In 42 min",
    status: "Healthy",
    source: "mission-control runtime",
    owner: "mission-control",
    icon: Database,
  },
  {
    name: "Safety gate review",
    purpose: "Check high-risk actions and flag anything needing human approval before execution.",
    frequency: "Daily at 09:30",
    nextRun: "Tomorrow · 09:30",
    status: "Idle",
    source: "policy scheduler",
    owner: "OpenClaw policy layer",
    icon: ShieldCheck,
  },
];

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Healthy"
      ? "bg-emerald-400/10 text-emerald-200 border-emerald-400/25"
      : status === "Scheduled"
        ? "bg-sky-400/10 text-sky-200 border-sky-400/25"
        : "bg-muted/60 text-muted-foreground border-border";

  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{status}</span>;
}

export default function AutomationsPage() {
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

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Automation roster" description="Name, purpose, cadence, next run, status, and source/owner in one place.">
          <div className="space-y-2">
            {automations.map((automation) => {
              const Icon = automation.icon;
              return (
                <div key={automation.name} className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-background/35 p-3 text-xs md:grid-cols-[1.3fr_1.8fr_0.9fr_0.9fr_auto] md:items-start">
                  <div className="flex items-start gap-2">
                    <div className="rounded-md border border-border/60 bg-muted/40 p-1.5 text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{automation.name}</div>
                      <div className="text-muted-foreground">{automation.purpose}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wide">Frequency</div>
                    <div className="mt-1 font-medium">{automation.frequency}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wide">Next run</div>
                    <div className="mt-1 font-medium">{automation.nextRun}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wide">Source / owner</div>
                    <div className="mt-1 font-medium">{automation.source}</div>
                    <div className="text-muted-foreground">{automation.owner}</div>
                  </div>
                  <div className="md:pt-4">
                    <StatusPill status={automation.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle>Surface notes</CardTitle>
            <CardDescription>How to read and extend the automation registry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>This page stays intentionally compact so operators can scan cadence, ownership, and status without leaving the shell.</p>
            <div className="rounded-lg border border-border/60 bg-background/35 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <PlayCircle className="h-3.5 w-3.5 text-sky-200" />
                Obsidian daily linker
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Runs daily at noon to keep daily notes stitched into the memory workflow.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
