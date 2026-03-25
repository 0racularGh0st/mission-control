"use client";

import { useEffect, useState } from "react";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

export type AgentState = "idle" | "busy" | "thinking";

export interface AgentPosition {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: AgentState;
  animFrame: number;
}

export interface OfficeState {
  jarvis: AgentPosition;
  cody: AgentPosition;
  lastUpdated: number;
}

const POLL_INTERVAL_MS = 5_000;

// Room layout positions (canvas coordinates)
const MAIN_OFFICE_DESK_X = 160;
const MAIN_OFFICE_DESK_Y = 180;
const BREAK_ROOM_SOFA_X = 560;
const BREAK_ROOM_SOFA_Y = 280;

function getLatestActivity(activities: AgentActivityEntry[], agentType: string): AgentActivityEntry | undefined {
  return activities.find((a) => a.agentType === agentType);
}

function activityToState(activity: AgentActivityEntry | undefined): AgentState {
  if (!activity) return "idle";
  if (activity.status === "running") return "busy";
  // completed or failed → treat as idle (will walk back to break room)
  return "idle";
}

export function useOfficeViewModel() {
  const [state, setState] = useState<OfficeState>({
    jarvis: {
      x: BREAK_ROOM_SOFA_X,
      y: BREAK_ROOM_SOFA_Y,
      targetX: BREAK_ROOM_SOFA_X,
      targetY: BREAK_ROOM_SOFA_Y,
      state: "idle",
      animFrame: 0,
    },
    cody: {
      x: BREAK_ROOM_SOFA_X,
      y: BREAK_ROOM_SOFA_Y + 40,
      targetX: BREAK_ROOM_SOFA_X,
      targetY: BREAK_ROOM_SOFA_Y + 40,
      state: "idle",
      animFrame: 0,
    },
    lastUpdated: 0,
  });

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/agents/activity", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const activities: AgentActivityEntry[] = data.activities ?? [];

        const jarvisActivity = getLatestActivity(activities, "jarvis");
        const codyActivity = getLatestActivity(activities, "cody");

        const jarvisNewState = activityToState(jarvisActivity);
        const codyNewState = activityToState(codyActivity);

        setState((prev) => {
          const next = { ...prev, lastUpdated: Date.now() };

          // Jarvis
          const jarvisBusy = jarvisNewState === "busy";
          next.jarvis = {
            ...prev.jarvis,
            state: jarvisNewState,
            targetX: jarvisBusy ? MAIN_OFFICE_DESK_X : BREAK_ROOM_SOFA_X,
            targetY: jarvisBusy ? MAIN_OFFICE_DESK_Y : BREAK_ROOM_SOFA_Y,
          };

          // Cody
          const codyBusy = codyNewState === "busy";
          next.cody = {
            ...prev.cody,
            state: codyNewState,
            targetX: codyBusy ? MAIN_OFFICE_DESK_X + 120 : BREAK_ROOM_SOFA_X,
            targetY: codyBusy ? MAIN_OFFICE_DESK_Y + 60 : BREAK_ROOM_SOFA_Y + 40,
          };

          return next;
        });
      } catch {
        // keep previous state on error
      }
    }

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
          lastUpdated: Date.now(),
        }));
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return { state };
}
