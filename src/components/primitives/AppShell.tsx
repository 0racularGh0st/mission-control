"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CommandPalette } from "@/src/components/CommandPalette";
import { ApprovalsBadge } from "@/src/components/ApprovalsBadge";
import { RetriesBadge } from "@/src/components/RetriesBadge";
import { InspectorPanel } from "@/src/components/InspectorPanel";
import { useInspector } from "@/src/runtime/inspector/context";

import { cn } from "@/lib/utils";
import { CommandBar } from "@/src/components/primitives/CommandBar";
import { JarvisLogo } from "@/src/components/primitives/JarvisLogo";
import { Panel } from "@/src/components/primitives/Panel";

const navItems = [
  { label: "Dashboard", href: "/" },
  { label: "Models", href: "/models" },
  { label: "Agents", href: "/agents" },
  { label: "Tasks", href: "/tasks" },
  { label: "Approvals", href: "/approvals", badge: "approvals" },
  { label: "Retries", href: "/retries", badge: "retries" },
  { label: "Automations", href: "/automations" },
  { label: "Logs", href: "/logs" },
  { label: "Memory", href: "/memory" },
  { label: "Timeline", href: "/timeline" },
  { label: "Calendar", href: "/calendar" },
  { label: "Claude", href: "/claude" },
  { label: "Office", href: "/office" },
  { label: "Settings", href: "/settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inspector = useInspector();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette />
      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] grid-cols-1 gap-3 p-3 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="glass-panel sticky top-0 hidden rounded-xl p-3 xl:block h-fit">
          <div className="mb-3 flex items-center gap-2 px-2 py-1">
            <JarvisLogo size={24} />
            <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Mission Control
            </span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-lg px-2 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent/35 text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {item.label}
                  {"badge" in item && item.badge === "approvals" && <ApprovalsBadge />}
                  {"badge" in item && item.badge === "retries" && <RetriesBadge />}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 flex-col gap-3">
          <header className="glass-panel space-y-2 rounded-xl p-2">
            <CommandBar className="bg-transparent p-0" />
            <nav className="flex gap-1 overflow-x-auto pb-1 xl:hidden">
              {navItems.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 rounded-md px-2 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-accent/35 text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
          <main className="min-h-0 flex-1">{children}</main>
        </div>

        <aside className="hidden xl:block">
          <Panel
            className="h-full"
            title="Inspector"
            description={inspector.isOpen && inspector.data
              ? `${inspector.data.meta.source} · ${inspector.data.meta.model}`
              : "Context panel for selected entities and quick metadata."}
          >
            <InspectorPanel
              data={inspector.data}
              loading={inspector.loading}
              error={inspector.error}
              selectedMessageIndex={inspector.selectedMessageIndex}
              onSelectMessage={inspector.selectMessage}
              onClose={inspector.close}
            />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
