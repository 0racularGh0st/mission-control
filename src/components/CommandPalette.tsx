"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { Activity, Bot, Building2, DollarSign, Home, ListTodo, Logs, MemoryStick, RotateCcw, Settings, ShieldCheck, Sparkles, Workflow } from "lucide-react";

type CommandEntry = {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const commands: CommandEntry[] = [
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      shortcut: "G D",
      icon: <Home className="size-4" />,
      action: () => { router.push("/"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-models",
      label: "Go to Models",
      shortcut: "G M",
      icon: <Sparkles className="size-4" />,
      action: () => { router.push("/models"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-agents",
      label: "Go to Agents",
      icon: <Bot className="size-4" />,
      action: () => { router.push("/agents"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-tasks",
      label: "Go to Tasks",
      icon: <ListTodo className="size-4" />,
      action: () => { router.push("/tasks"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-approvals",
      label: "Go to Approvals",
      shortcut: "G A",
      icon: <ShieldCheck className="size-4" />,
      action: () => { router.push("/approvals"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-retries",
      label: "Go to Retries",
      shortcut: "G R",
      icon: <RotateCcw className="size-4" />,
      action: () => { router.push("/retries"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-automations",
      label: "Go to Automations",
      icon: <Workflow className="size-4" />,
      action: () => { router.push("/automations"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-logs",
      label: "Go to Logs",
      icon: <Logs className="size-4" />,
      action: () => { router.push("/logs"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-memory",
      label: "Go to Memory",
      icon: <MemoryStick className="size-4" />,
      action: () => { router.push("/memory"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-timeline",
      label: "Go to Timeline",
      shortcut: "G T",
      icon: <Activity className="size-4" />,
      action: () => { router.push("/timeline"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-costs",
      label: "Go to Costs",
      icon: <DollarSign className="size-4" />,
      action: () => { router.push("/costs"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-office",
      label: "Go to Office",
      icon: <Building2 className="size-4" />,
      action: () => { router.push("/office"); setOpen(false); },
      group: "Navigation",
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      icon: <Settings className="size-4" />,
      action: () => { router.push("/settings"); setOpen(false); },
      group: "Navigation",
    },
  ];

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleOpenEvent);
    };
  }, []);

  const grouped = commands.reduce<Record<string, CommandEntry[]>>((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder="Type a command or search…" autoFocus />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {Object.entries(grouped).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((cmd) => (
                <CommandItem key={cmd.id} value={cmd.label} onSelect={cmd.action}>
                  {cmd.icon}
                  <span>{cmd.label}</span>
                  {cmd.shortcut && <CommandShortcut>{cmd.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
