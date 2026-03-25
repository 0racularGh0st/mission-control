import { Route } from "lucide-react";

import { Panel, SectionHeader } from "@/src/components/primitives";

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

      <Panel title="Automation roster" description="Name, purpose, cadence, next run, status, and source/owner in one place.">
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-8 text-sm text-muted-foreground text-center">
          No automations registered yet. Automation jobs will appear here once configured.
        </div>
      </Panel>
    </main>
  );
}
