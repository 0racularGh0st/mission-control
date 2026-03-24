import { cn } from "@/lib/utils";
import { Panel } from "@/src/components/primitives/Panel";

type MetricCardProps = {
  label: string;
  value: string;
  delta?: string;
  className?: string;
};

export function MetricCard({ label, value, delta, className }: MetricCardProps) {
  return (
    <Panel className={cn("gap-3", className)}>
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      {delta ? <div className="text-muted text-xs">{delta}</div> : null}
    </Panel>
  );
}
