import { NextRequest, NextResponse } from "next/server";
import { readAutomations } from "@/src/server/automationReader";
import { readCronJobs, projectCronRuns } from "@/src/server/cronJobsReader";
import type { CalendarDay, CalendarItem, CalendarResponse } from "@/src/types/calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar?month=3&year=2026
 * Returns projected cron/scheduled runs for the given month.
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const month = parseInt(params.get("month") ?? String(now.getMonth() + 1), 10);
    const year = parseInt(params.get("year") ?? String(now.getFullYear()), 10);

    if (month < 1 || month > 12 || year < 2000 || year > 2100) {
      return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
    }

    const daysInMonth = new Date(year, month, 0).getDate();

    const dayMap = new Map<string, CalendarItem[]>();

    // Project cron runs onto calendar days
    const automations = await readAutomations();
    for (const auto of automations) {
      if (auto.status !== "active") continue;

      // For daily crons, project one entry per day in the month
      if (auto.schedule.startsWith("daily at ")) {
        const timePart = auto.schedule.replace("daily at ", "");
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const items = dayMap.get(dayStr) ?? [];
          items.push({
            id: `cron-${auto.label}-${dayStr}`,
            title: auto.label,
            date: `${dayStr}T${timePart}:00`,
            source: "cron",
            detail: auto.schedule,
            kind: auto.schedule,
          });
          dayMap.set(dayStr, items);
        }
      } else if (auto.schedule === "hourly" || auto.schedule.startsWith("every ")) {
        // For interval-based crons, show one entry per day as a summary
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const items = dayMap.get(dayStr) ?? [];
          items.push({
            id: `cron-${auto.label}-${dayStr}`,
            title: auto.label,
            date: `${dayStr}T00:00:00`,
            source: "cron",
            detail: auto.schedule,
            kind: auto.schedule,
          });
          dayMap.set(dayStr, items);
        }
      }
    }

    // Project openclaw cron jobs (agent-scheduled: market updates, daily tasks, etc.)
    const cronJobs = await readCronJobs();
    const cronRuns = projectCronRuns(cronJobs, month, year);
    for (const run of cronRuns) {
      const items = dayMap.get(run.date) ?? [];
      items.push({
        id: `cron-${run.jobId}-${run.date}`,
        title: run.description || run.name,
        date: `${run.date}T${run.time}:00`,
        source: "cron",
        detail: run.scheduleLabel,
        kind: run.scheduleLabel,
      });
      dayMap.set(run.date, items);
    }

    // Build ordered day array
    const days: CalendarDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        date: dayStr,
        items: dayMap.get(dayStr) ?? [],
      });
    }

    const response: CalendarResponse = { days, month, year };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load calendar", detail: String(error) },
      { status: 500 },
    );
  }
}
