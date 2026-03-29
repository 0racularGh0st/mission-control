"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { CalendarDay, CalendarResponse } from "@/src/types/calendar";

export interface CalendarState {
  days: CalendarDay[];
  month: number;
  year: number;
  loading: boolean;
  error: string | null;
}

export function useCalendarViewModel() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCrons, setShowCrons] = useState(true);

  const fetchCalendar = useCallback(async (m: number, y: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar?month=${m}&year=${y}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CalendarResponse = await res.json();
      setDays(data.days);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar(month, year);
  }, [month, year, fetchCalendar]);

  const prevMonth = useCallback(() => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const filteredDays = useMemo(() => {
    if (showCrons) return days;
    return days.map((day) => ({
      ...day,
      items: day.items.filter((item) => item.source !== "cron"),
    }));
  }, [days, showCrons]);

  return {
    month,
    year,
    days: filteredDays,
    loading,
    error,
    showCrons,
    setShowCrons,
    prevMonth,
    nextMonth,
  };
}
