export interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  model: string;
  health: "healthy" | "busy" | "unknown";
}

export async function readAgents(): Promise<AgentInfo[]> {
  try {
    const { execSync } = await import("child_process");
    const output = execSync("openclaw agents list", {
      encoding: "utf-8",
      timeout: 10_000,
    });
    return parseAgentsList(output);
  } catch (err) {
    console.error("[agentsReader] failed to read agents:", err);
    return getFallbackAgents();
  }
}

function parseAgentsList(output: string): AgentInfo[] {
  const agents: AgentInfo[] = [];
  // Format:
  // Agents:
  // - main (default)
  //   Identity: 🤖 Jarvis (IDENTITY.md)
  //   Workspace: ~/.openclaw/workspace
  //   Agent dir: ~/.openclaw/agents/main/agent
  //   Model: minimax/MiniMax-M2.7
  // ...
  // - cody (Cody)
  //   Workspace: ~/.openclaw/workspace-cody
  //   Agent dir: ~/.openclaw/agents/cody/agent
  //   Model: minimax/MiniMax-M2.7

  const lines = output.split("\n");
  let currentAgent: Partial<AgentInfo> | null = null;

  for (const line of lines) {
    const agentMatch = line.match(/^-\s+(\S+)\s*(?:\(([^)]+)\))?/);
    if (agentMatch) {
      if (currentAgent?.id) {
        agents.push(currentAgent as AgentInfo);
      }
      const id = agentMatch[1];
      const nameFromHeader = agentMatch[2] ?? id;
      currentAgent = { id, name: nameFromHeader };
      continue;
    }

    if (currentAgent) {
      if (line.includes("Workspace:")) {
        currentAgent.workspace = line.split("Workspace:")[1].trim();
      } else if (line.includes("Model:")) {
        currentAgent.model = line.split("Model:")[1].trim();
      }
    }
  }

  if (currentAgent?.id) {
    agents.push(currentAgent as AgentInfo);
  }

  // Default health based on known agents
  return agents.map((a) => ({
    ...a,
    health: "healthy" as const,
  }));
}

function getFallbackAgents(): AgentInfo[] {
  return [
    { id: "main", name: "Jarvis", workspace: "~/.openclaw/workspace", model: "minimax/MiniMax-M2.7", health: "healthy" },
    { id: "cody", name: "Cody", workspace: "~/.openclaw/workspace-cody", model: "minimax/MiniMax-M2.7", health: "healthy" },
  ];
}
