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
  contextWindow: number;
  maxTokens: number;
  alias?: string;
}

export interface RoutingChainEntry {
  position: number;
  model: string;
  label: string;
  reason: string;
}

export interface ModelRoutingVisualization {
  primaryModel: string;
  fallbackChain: RoutingChainEntry[];
  taskClassificationRules: { taskType: string; model: string }[];
  configuredProviders: string[];
  models: ModelEntry[];
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
      primaryModel: "MiniMax-M2.7",
      fallbackChain: [],
      taskClassificationRules: [],
      configuredProviders: [],
      models: [],
    };
  }

  const modelsConfig = config.models as Record<string, unknown> | undefined;
  const agentsConfig = config.agents as Record<string, unknown> | undefined;

  // Get configured providers
  const providers = (modelsConfig?.providers as Record<string, unknown>) ?? {};
  const configuredProviders = Object.keys(providers);

  // Get all models
  const allModels: ModelEntry[] = [];
  for (const [providerName, providerData] of Object.entries(providers)) {
    const provider = providerData as Record<string, unknown>;
    const models = (provider.models as unknown[]) ?? [];
    for (const modelData of models) {
      const m = modelData as Record<string, unknown>;
      const cost = (m.cost as Record<string, number>) ?? {};
      allModels.push({
        id: `${providerName}/${String(m.id ?? "")}`,
        name: String(m.name ?? m.id ?? ""),
        provider: providerName,
        reasoning: Boolean(m.reasoning ?? false),
        inputCostPer1M: cost.input ?? 0,
        outputCostPer1M: cost.output ?? 0,
        contextWindow: Number(m.contextWindow ?? 0),
        maxTokens: Number(m.maxTokens ?? 0),
      });
    }
  }

  // Get default model routing
  const defaults = (agentsConfig?.defaults as Record<string, unknown>) ?? {};
  const modelDefaults = (defaults.model as Record<string, unknown>) ?? {};
  const primaryModel = String(modelDefaults.primary ?? "MiniMax-M2.7");
  const fallbacks = (modelDefaults.fallbacks as string[]) ?? [];

  const fallbackChain: RoutingChainEntry[] = fallbacks.map((fb, i) => ({
    position: i + 1,
    model: fb,
    label: `Fallback ${i + 1}`,
    reason: `Primary unavailable or timeout`,
  }));

  // Task classification rules (from model config)
  const taskClassificationRules: { taskType: string; model: string }[] = [];
  // Default: heavy tasks use MiniMax, fast tasks use nano
  taskClassificationRules.push(
    { taskType: "reasoning", model: "minimax/MiniMax-M2.7" },
    { taskType: "coding", model: "openai/gpt-5.4-mini" },
    { taskType: "fast-checks", model: "openai/gpt-5.4-nano" },
    { taskType: "image", model: "openai/gpt-image-1" },
  );

  return {
    primaryModel,
    fallbackChain,
    taskClassificationRules,
    configuredProviders,
    models: allModels,
  };
}
