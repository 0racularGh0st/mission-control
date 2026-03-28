"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useInspectorViewModel } from "@/src/viewmodels/useInspectorViewModel";
import type { InspectorSource } from "@/src/types/inspector";

type InspectorContextValue = ReturnType<typeof useInspectorViewModel>;

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const vm = useInspectorViewModel();

  // Global keyboard shortcuts: `i` to toggle, Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      if (e.key === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        vm.togglePanel();
        return;
      }

      if (e.key === "Escape" && vm.isOpen) {
        vm.close();
        return;
      }

      // Arrow keys for message navigation when inspector is open
      if (vm.isOpen && vm.data) {
        if (e.key === "ArrowDown" || e.key === "j") {
          // Only intercept if no other list is focused
          if (!document.querySelector("[data-retry-id].border-accent\\/50, [data-approval-id].border-accent\\/50")) {
            e.preventDefault();
            vm.selectNextMessage();
          }
          return;
        }
        if (e.key === "ArrowUp" || e.key === "k") {
          if (!document.querySelector("[data-retry-id].border-accent\\/50, [data-approval-id].border-accent\\/50")) {
            e.preventDefault();
            vm.selectPrevMessage();
          }
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [vm]);

  return (
    <InspectorContext.Provider value={vm}>
      {children}
    </InspectorContext.Provider>
  );
}

export function useInspector(): InspectorContextValue {
  const ctx = useContext(InspectorContext);
  if (!ctx) {
    throw new Error("useInspector must be used within InspectorProvider");
  }
  return ctx;
}
