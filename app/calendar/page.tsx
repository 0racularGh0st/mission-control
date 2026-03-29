import { CalendarClient } from "@/src/components/CalendarClient";
import { Panel } from "@/src/components/primitives/Panel";

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-3">
      <Panel
        title="Calendar"
        description="Monthly view of timeline events and planned cron runs. Toggle cron visibility with the filter button."
      >
        <CalendarClient />
      </Panel>
    </div>
  );
}
