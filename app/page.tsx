import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";

const metrics = [
  { label: "Active agents", value: "04", delta: "+1 in last hour" },
  { label: "Running tasks", value: "12", delta: "3 waiting review" },
  { label: "Token burn", value: "182k", delta: "$3.14 today" },
  { label: "Alerts", value: "02", delta: "1 high priority" },
];

export default function Home() {
  return (
    <main className="dashboard-shell space-y-6">
      <SectionHeader
        title="Mission Control"
        description="Dark-first command center for routing and observability."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-1">
        <Panel
          title="Queue snapshot"
          description="Live execution lanes will stream here in Ticket 5+."
        >
          <div className="text-muted">No active queue data yet.</div>
        </Panel>
      </section>
    </main>
  );
}
