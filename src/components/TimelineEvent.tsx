"use client";

import { Bot, CheckSquare, DollarSign, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent as TimelineEventType, TimelineSource } from "@/src/types/timeline";

const SOURCE_ICONS: Record<TimelineSource, React.ReactNode> = {
  tasks: <CheckSquare className="h-3.5 w-3.5" />,
  agents: <Bot className="h-3.5 w-3.5" />,
  sessions: <Terminal className="h-3.5 w-3.5" />,
  costs: <DollarSign className="h-3.5 w-3.5" />,
};

const SOURCE_COLORS: Record<TimelineSource, string> = {
  tasks: "text-blue-400",
  agents: "text-emerald-400",
  sessions: "text-violet-400",
  costs: "text-amber-400",
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function parseDetail(detail: string): string | null {
  if (!detail) return null;
  try {
    const obj = JSON.parse(detail);
    if (obj.from && obj.to) return `${obj.from} → ${obj.to}`;
    return detail;
  } catch {
    return detail;
  }
}

interface TimelineEventProps {
  event: TimelineEventType;
  selected?: boolean;
}

export function TimelineEventRow({ event, selected }: TimelineEventProps) {
  const detailText = parseDetail(event.detail);

  return (
    <div
      className={cn(
        "group rounded-lg border border-border/60 bg-background/35 px-3 py-2.5 transition-colors",
        selected && "border-accent/50 bg-accent/10",
      )}
      data-event-id={event.id}
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-0.5 shrink-0", SOURCE_COLORS[event.source])}>
          {SOURCE_ICONS[event.source]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-foreground">{event.title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatTimestamp(event.occurredAt)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {event.actor && <span>{event.actor}</span>}
            <span>·</span>
            <span>{event.source}</span>
            {detailText && (
              <>
                <span>·</span>
                <span>{detailText}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
