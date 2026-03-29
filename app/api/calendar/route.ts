import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/server/db";
import { readAutomations } from "@/src/server/automationReader";
import type { CalendarDay, CalendarItem, CalendarResponse } from "@/src/types/calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar?month=3&year=2026
 * Returns timeline events + projected cron runs for the given month.
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

    // Date range for the month
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Fetch timeline events for this month, aggregated by day + event_type
    const db = getDb();
    const aggRows = db
      .prepare(
        `SELECT substr(occurred_at, 1, 10) AS day_key,
                event_type,
                COUNT(*) AS cnt,
                MIN(occurred_at) AS first_at
         FROM timeline_events
         WHERE occurred_at >= ? AND occurred_at < ?
         GROUP BY day_key, event_type
         ORDER BY day_key, first_at`,
      )
      .all(startDate, endDate) as {
      day_key: string;
      event_type: string;
      cnt: number;
      first_at: string;
    }[];

    // Index aggregated items by day
    const dayMap = new Map<string, CalendarItem[]>();

    for (const row of aggRows) {
      const items = dayMap.get(row.day_key) ?? [];
      const label =
        row.cnt === 1
          ? row.event_type.replace(".", " ")
          : `${row.cnt} ${row.event_type.replace(".", " ")} events`;
      items.push({
        id: `agg-${row.day_key}-${row.event_type}`,
        title: label,
        date: row.first_at,
        source: "timeline",
        detail: `${row.cnt} event${row.cnt !== 1 ? "s" : ""}`,
        kind: row.event_type,
      });
      dayMap.set(row.day_key, items);
    }

    // 2. Project cron runs onto calendar days
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

    // 3. Build ordered day array
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
