import { Panel, SectionHeader } from "@/src/components/primitives";

export default function CostsPage() {
  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Costs"
        description="Costs surface is scaffolded and ready for Ticket 5+ implementation."
      />
      <Panel title="Costs workspace" description="Navigation stub connected to the app shell.">
        <div className="text-muted">Content coming in the next tickets.</div>
      </Panel>
    </div>
  );
}
