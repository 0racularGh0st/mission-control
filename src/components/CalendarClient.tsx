"use client";

import { useState } from "react";
import { useCalendarViewModel } from "@/src/viewmodels/useCalendarViewModel";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Timer, Activity } from "lucide-react";
import type { CalendarItem, CalendarDay } from "@/src/types/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ItemDot({ item }: { item: CalendarItem }) {
  const isCron = item.source === "cron";
  return (
    <div
      className={cn(
        "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
        isCron
          ? "bg-amber-500/20 text-amber-400"
          : "bg-accent/20 text-emerald-400",
      )}
      title={`${item.title}${item.detail ? ` — ${item.detail}` : ""}`}
    >
      {item.title}
    </div>
  );
}

function DayModal({
  day,
  open,
  onClose,
  onSelectItem,
}: {
  day: CalendarDay;
  open: boolean;
  onClose: () => void;
  onSelectItem: (item: CalendarItem) => void;
}) {
  const sorted = [...day.items].sort((a, b) => a.date.localeCompare(b.date));
  const label = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {sorted.length} item{sorted.length !== 1 && "s"}
          </DialogDescription>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No events for this day.</p>
        ) : (
          <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto -mx-1 px-1">
            {sorted.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                  item.source === "cron"
                    ? "text-amber-400"
                    : "text-emerald-400",
                )}
              >
                {item.source === "cron" ? (
                  <Timer className="size-3.5 shrink-0" />
                ) : (
                  <Activity className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{item.title}</span>
                <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                  {item.kind}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemDetailModal({
  item,
  open,
  onClose,
}: {
  item: CalendarItem;
  open: boolean;
  onClose: () => void;
}) {
  const isCron = item.source === "cron";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCron ? (
              <Timer className="size-4 text-amber-400" />
            ) : (
              <Activity className="size-4 text-emerald-400" />
            )}
            {item.title}
          </DialogTitle>
          <DialogDescription>{item.kind}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">Source:</span>
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs",
                isCron ? "bg-amber-500/20 text-amber-400" : "bg-accent/20 text-emerald-400",
              )}
            >
              {item.source}
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium text-foreground">Date:</span>
            {item.date}
          </div>
          <div>
            <span className="font-medium text-foreground">Detail:</span>
            <p className="mt-1 text-muted-foreground whitespace-pre-wrap">
              {item.detail || "No info available"}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CalendarClient() {
  const {
    month,
    year,
    days,
    loading,
    error,
    showCrons,
    setShowCrons,
    prevMonth,
    nextMonth,
  } = useCalendarViewModel();

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);

  // Compute grid offset: what weekday does day 1 fall on? (Mon=0)
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7;

  const today = new Date();
  const todayStr =
    today.getFullYear() === year && today.getMonth() + 1 === month
      ? `${year}-${String(month).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Header: nav + filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="text-sm font-medium min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </h2>
          <button
            onClick={nextMonth}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <button
          onClick={() => setShowCrons(!showCrons)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
            showCrons
              ? "bg-amber-500/20 text-amber-400"
              : "bg-muted/40 text-muted-foreground",
          )}
        >
          <Timer className="size-3" />
          {showCrons ? "Crons visible" : "Crons hidden"}
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Activity className="size-3 text-emerald-400" />
          Events
        </span>
        <span className="flex items-center gap-1">
          <Timer className="size-3 text-amber-400" />
          Crons
        </span>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <>
          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-muted-foreground">
            {DAY_HEADERS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-px">
            {/* Empty cells before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px]" />
            ))}

            {days.map((day) => {
              const isToday = day.date === todayStr;
              const dayNum = parseInt(day.date.slice(8), 10);

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[80px] rounded-md border p-1.5 transition-colors text-left cursor-pointer",
                    isToday
                      ? "border-accent/50 bg-accent/5"
                      : "border-border/40 bg-card/40 hover:bg-card/60",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 text-[11px] font-medium",
                      isToday ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {day.items.slice(0, 3).map((item) => (
                      <ItemDot key={item.id} item={item} />
                    ))}
                    {day.items.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{day.items.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Day modal — all events for a clicked date */}
      {selectedDay && (
        <DayModal
          day={selectedDay}
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          onSelectItem={(item) => setSelectedItem(item)}
        />
      )}

      {/* Item detail modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          open={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
