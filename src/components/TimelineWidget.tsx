"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Panel } from "@/src/components/primitives";
import { TimelineEventRow } from "@/src/components/TimelineEvent";
import type { TimelineEvent } from "@/src/types/timeline";

interface TimelineWidgetProps {
  events: TimelineEvent[];
}

export function TimelineWidget({ events }: TimelineWidgetProps) {
  return (
    <Panel
      title="Recent activity"
      description="Latest events across Mission Control."
    >
      {events.length > 0 ? (
        <div className="space-y-1.5">
          {events.map((event) => (
            <TimelineEventRow key={event.id} event={event} />
          ))}
          <Link
            href="/timeline"
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View full timeline
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-xs text-muted-foreground">
          No activity yet. Events will appear as tasks and agents run.
        </div>
      )}
    </Panel>
  );
}
