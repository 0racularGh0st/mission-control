// Calendar view types — shared across client and server

export type CalendarItemSource = "timeline" | "cron";

export interface CalendarItem {
  id: string;
  title: string;
  date: string; // ISO date string
  source: CalendarItemSource;
  detail: string;
  /** Timeline event type or cron schedule label */
  kind: string;
}

export interface CalendarDay {
  date: string; // YYYY-MM-DD
  items: CalendarItem[];
}

export interface CalendarResponse {
  days: CalendarDay[];
  month: number; // 1-12
  year: number;
}
