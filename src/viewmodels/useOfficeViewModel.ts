"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AgentState = "idle" | "busy" | "thinking";

export interface AgentPosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: AgentState;
  detail: string;
  animFrame: number;
}

export interface OfficeState {
  jarvis: AgentPosition;
  cody: AgentPosition;
  claudius: AgentPosition;
  lastUpdated: number;
}

/** Shape returned by /api/office/presence */
interface PresenceInfo {
  state: AgentState;
  detail: string;
  sessionKey: string | null;
  updatedAt: number | null;
}

const POLL_INTERVAL_MS = 5_000;

// Room layout positions (canvas coordinates)
const MAIN_OFFICE_DESK_X = 160;
const MAIN_OFFICE_DESK_Y = 180;
const BREAK_ROOM_SOFA_X = 560;
const BREAK_ROOM_SOFA_Y = 280;
// Second desk for Claudius (row 2, middle desk)
const DESK2_X = 220;
const DESK2_Y = 280;
// Thinking position — at the whiteboard area between desk and sofa
const THINKING_X = 360;
const THINKING_Y = 220;

export function useOfficeViewModel() {
  const [state, setState] = useState<OfficeState>({
    jarvis: {
      x: BREAK_ROOM_SOFA_X,
      y: BREAK_ROOM_SOFA_Y,
      targetX: BREAK_ROOM_SOFA_X,
      targetY: BREAK_ROOM_SOFA_Y,
      state: "idle",
      detail: "",
      animFrame: 0,
    },
    cody: {
      x: BREAK_ROOM_SOFA_X,
      y: BREAK_ROOM_SOFA_Y + 40,
      targetX: BREAK_ROOM_SOFA_X,
      targetY: BREAK_ROOM_SOFA_Y + 40,
      state: "idle",
      detail: "",
      animFrame: 0,
    },
    claudius: {
      x: BREAK_ROOM_SOFA_X + 60,
      y: BREAK_ROOM_SOFA_Y + 20,
      targetX: BREAK_ROOM_SOFA_X + 60,
      targetY: BREAK_ROOM_SOFA_Y + 20,
      state: "idle",
      detail: "",
      animFrame: 0,
    },
    lastUpdated: 0,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/office/presence", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, PresenceInfo>;

        const jp = data.jarvis;
        const cp = data.cody;
        const cl = data.claudius;
        if (!jp || !cp) return;

        setState((prev) => {
          const next = { ...prev, lastUpdated: Date.now() };

          // Jarvis position based on state
          next.jarvis = {
            ...prev.jarvis,
            state: jp.state,
            detail: jp.detail,
            targetX: jp.state === "busy" ? MAIN_OFFICE_DESK_X : jp.state === "thinking" ? THINKING_X : BREAK_ROOM_SOFA_X,
            targetY: jp.state === "busy" ? MAIN_OFFICE_DESK_Y : jp.state === "thinking" ? THINKING_Y : BREAK_ROOM_SOFA_Y,
          };

          // Cody position based on state
          next.cody = {
            ...prev.cody,
            state: cp.state,
            detail: cp.detail,
            targetX: cp.state === "busy" ? MAIN_OFFICE_DESK_X + 120 : cp.state === "thinking" ? THINKING_X + 60 : BREAK_ROOM_SOFA_X,
            targetY: cp.state === "busy" ? MAIN_OFFICE_DESK_Y + 60 : cp.state === "thinking" ? THINKING_Y + 40 : BREAK_ROOM_SOFA_Y + 40,
          };

          // Claudius position based on state — uses middle desk (row 2)
          if (cl) {
            next.claudius = {
              ...prev.claudius,
              state: cl.state,
              detail: cl.detail,
              targetX: cl.state === "busy" ? DESK2_X : cl.state === "thinking" ? DESK2_X : BREAK_ROOM_SOFA_X + 60,
              targetY: cl.state === "busy" ? DESK2_Y : cl.state === "thinking" ? DESK2_Y : BREAK_ROOM_SOFA_Y + 20,
            };
          }

          return next;
        });
      } catch {
        // keep previous state on error
      }
    }

    pollRef.current = poll;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Tick animation frames
  useEffect(() => {
    let frame: number;
    let lastTime = 0;
    function tick(time: number) {
      if (time - lastTime > 100) {
        lastTime = time;
        setState((prev) => ({
          ...prev,
          jarvis: { ...prev.jarvis, animFrame: (prev.jarvis.animFrame + 1) % 8 },
          cody: { ...prev.cody, animFrame: (prev.cody.animFrame + 1) % 8 },
          claudius: { ...prev.claudius, animFrame: (prev.claudius.animFrame + 1) % 8 },
        }));
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await pollRef.current?.();
    setIsRefreshing(false);
  }, []);

  return { state, refresh, isRefreshing };
}
