import { OfficeClient } from "@/src/components/OfficeClient";
import { Panel } from "@/src/components/primitives/Panel";

export default function OfficePage() {
  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Agent Office"
        description="Real-time pixel-art view of agent activity. Watch Jarvis and Cody move between the main office and break room based on their current workload."
      >
        <OfficeClient />
      </Panel>
    </div>
  );
}
