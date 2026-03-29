// Reads OpenClaw config and formats model routing data for visualization

import fs from "fs/promises";

const OPENCLAW_CONFIG = "/Users/nigel/.openclaw/openclaw.json";

export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  cacheReadCostPer1M?: number;
  cacheWriteCostPer1M?: number;
  contextWindow: number;
  maxTokens: number;
  /** True if model is defined in providers with full specs */
  hasSpecs: boolean;
  /** Which agents are assigned to this model */
  assignedAgents: string[];
  /** True if this is the default primary model */
  isPrimary: boolean;
  /** True if this is in the fallback chain */
  isFallback: boolean;
}

export interface RoutingChainEntry {
  position: number;
  model: string;
  label: string;
  reason: string;
}

export interface AgentModelAssignment {
  agentId: string;
  agentName: string;
  model: string;
  workspace?: string;
}

export interface AuthProviderInfo {
  provider: string;
  mode: string;
  email?: string;
}

export interface ModelRoutingVisualization {
  primaryModel: string;
  heartbeatModel: string | null;
  fallbackChain: RoutingChainEntry[];
  configuredProviders: string[];
  models: ModelEntry[];
  agentAssignments: AgentModelAssignment[];
  authProviders: AuthProviderInfo[];
}

async function readOpenClawConfig(): Promise<Record<string, unknown> | null> {
  try {
    const raw = await fs.readFile(OPENCLAW_CONFIG, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function getModelRoutingVisualization(): Promise<ModelRoutingVisualization> {
  const config = await readOpenClawConfig();

  if (!config) {
    return {
      primaryModel: "unknown",
      heartbeatModel: null,
      fallbackChain: [],
      configuredProviders: [],
      models: [],
      agentAssignments: [],
      authProviders: [],
    };
  }

  const modelsConfig = config.models as Record<string, unknown> | undefined;
  const agentsConfig = config.agents as Record<string, unknown> | undefined;
  const authConfig = config.auth as Record<string, unknown> | undefined;

  // --- Auth providers ---
  const authProfiles = (authConfig?.profiles as Record<string, Record<string, unknown>>) ?? {};
  const authProviders: AuthProviderInfo[] = Object.values(authProfiles).map((p) => ({
    provider: String(p.provider ?? "unknown"),
    mode: String(p.mode ?? "unknown"),
    email: p.email ? String(p.email) : undefined,
  }));

  // --- Providers + models with full specs ---
  const providers = (modelsConfig?.providers as Record<string, unknown>) ?? {};
  const configuredProviders = Object.keys(providers);

  const specModels = new Map<string, ModelEntry>();
  for (const [providerName, providerData] of Object.entries(providers)) {
    const provider = providerData as Record<string, unknown>;
    const models = (provider.models as unknown[]) ?? [];
    for (const modelData of models) {
      const m = modelData as Record<string, unknown>;
      const cost = (m.cost as Record<string, number>) ?? {};
      const id = `${providerName}/${String(m.id ?? "")}`;
      specModels.set(id, {
        id,
        name: String(m.name ?? m.id ?? ""),
        provider: providerName,
        reasoning: Boolean(m.reasoning ?? false),
        inputCostPer1M: cost.input ?? 0,
        outputCostPer1M: cost.output ?? 0,
        cacheReadCostPer1M: cost.cacheRead,
        cacheWriteCostPer1M: cost.cacheWrite,
        contextWindow: Number(m.contextWindow ?? 0),
        maxTokens: Number(m.maxTokens ?? 0),
        hasSpecs: true,
        assignedAgents: [],
        isPrimary: false,
        isFallback: false,
      });
    }
  }

  // --- Default model routing ---
  const defaults = (agentsConfig?.defaults as Record<string, unknown>) ?? {};
  const modelDefaults = (defaults.model as Record<string, unknown>) ?? {};
  const primaryModel = String(modelDefaults.primary ?? "unknown");
  const fallbacks = (modelDefaults.fallbacks as string[]) ?? [];

  // Heartbeat model
  const heartbeatConfig = (defaults.heartbeat as Record<string, unknown>) ?? {};
  const heartbeatModel = heartbeatConfig.model ? String(heartbeatConfig.model) : null;

  // --- Collect all referenced model IDs (defaults.models, agents, primary, fallbacks, heartbeat) ---
  const referencedModels = new Set<string>();
  referencedModels.add(primaryModel);
  for (const fb of fallbacks) referencedModels.add(fb);
  if (heartbeatModel) referencedModels.add(heartbeatModel);

  const defaultsModels = (defaults.models as Record<string, unknown>) ?? {};
  for (const modelId of Object.keys(defaultsModels)) {
    referencedModels.add(modelId);
  }

  // --- Agent assignments ---
  const agentList = (agentsConfig?.list as Record<string, unknown>[]) ?? [];
  const agentAssignments: AgentModelAssignment[] = agentList.map((a) => {
    const model = String(a.model ?? primaryModel);
    referencedModels.add(model);
    return {
      agentId: String(a.id ?? ""),
      agentName: String(a.name ?? a.id ?? ""),
      model,
      workspace: a.workspace ? String(a.workspace) : undefined,
    };
  });

  // --- Merge: add referenced models not in providers as "external" entries ---
  const allModels = new Map(specModels);
  for (const modelId of referencedModels) {
    if (!allModels.has(modelId)) {
      const parts = modelId.split("/");
      const provider = parts.length > 1 ? parts[0] : "unknown";
      const name = parts.length > 1 ? parts.slice(1).join("/") : modelId;
      allModels.set(modelId, {
        id: modelId,
        name,
        provider,
        reasoning: false,
        inputCostPer1M: 0,
        outputCostPer1M: 0,
        contextWindow: 0,
        maxTokens: 0,
        hasSpecs: false,
        assignedAgents: [],
        isPrimary: false,
        isFallback: false,
      });
    }
  }

  // Track provider names for all models (including external)
  const allProviderNames = new Set(configuredProviders);
  for (const model of allModels.values()) {
    allProviderNames.add(model.provider);
  }

  // --- Mark primary/fallback and agent assignments ---
  const primary = allModels.get(primaryModel);
  if (primary) primary.isPrimary = true;

  for (const fb of fallbacks) {
    const m = allModels.get(fb);
    if (m) m.isFallback = true;
  }

  for (const assignment of agentAssignments) {
    const m = allModels.get(assignment.model);
    if (m) m.assignedAgents.push(assignment.agentName);
  }

  // --- Fallback chain ---
  const fallbackChain: RoutingChainEntry[] = fallbacks.map((fb, i) => ({
    position: i + 1,
    model: fb,
    label: `Fallback ${i + 1}`,
    reason: "Primary unavailable or timeout",
  }));

  // Sort models: primary first, then fallbacks, then by provider/name
  const modelArray = Array.from(allModels.values()).sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    if (a.isFallback !== b.isFallback) return a.isFallback ? -1 : 1;
    if (a.hasSpecs !== b.hasSpecs) return a.hasSpecs ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  return {
    primaryModel,
    heartbeatModel,
    fallbackChain,
    configuredProviders: Array.from(allProviderNames),
    models: modelArray,
    agentAssignments,
    authProviders,
  };
}
