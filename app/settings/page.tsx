import { Panel, SectionHeader } from "@/src/components/primitives";

export default function SettingsPage() {
  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Settings"
        description="Settings surface is scaffolded and ready for Ticket 5+ implementation."
      />
      <Panel title="Settings workspace" description="Navigation stub connected to the app shell.">
        <div className="text-muted">Content coming in the next tickets.</div>
      </Panel>
    </div>
  );
}
