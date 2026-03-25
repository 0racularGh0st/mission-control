"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, CheckCircle2, Cpu, GitBranch, Network, Sparkles } from "lucide-react";

import { Panel, SectionHeader } from "@/src/components/primitives";

type ModelEntry = {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  maxTokens: number;
  alias?: string;
};

type RoutingChainEntry = {
  position: number;
  model: string;
  label: string;
  reason: string;
};

type ModelRoutingViz = {
  primaryModel: string;
  fallbackChain: RoutingChainEntry[];
  taskClassificationRules: { taskType: string; model: string }[];
  configuredProviders: string[];
  models: ModelEntry[];
};

type RoutingState = {
  loading: boolean;
  data: ModelRoutingViz | null;
  error: string | null;
};

function ModelChip({ modelId }: { modelId: string }) {
  const [provider, name] = modelId.split("/");
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs font-mono">
      <span className="text-muted-foreground">{provider}/</span>
      <span className="text-foreground">{name}</span>
    </span>
  );
}

function RoutingFlowDiagram({ primary, chain }: { primary: string; chain: RoutingChainEntry[] }) {
  return (
    <div className="space-y-3">
      {/* Input classification node */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500/10 shrink-0">
          <Network className="size-5 text-sky-400" />
        </div>
        <div className="rounded-lg border border-border/60 bg-background/35 px-4 py-2">
          <div className="text-xs font-medium text-muted-foreground">Task arrives</div>
          <div className="text-sm">Router classifies request type</div>
        </div>
      </div>

      {/* Arrow */}
      <div className="ml-5 flex items-center gap-2">
        <ArrowDown className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Primary model</span>
      </div>

      {/* Primary model */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 shrink-0">
          <Sparkles className="size-5 text-emerald-400" />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-2">
          <ModelChip modelId={primary} />
          <CheckCircle2 className="size-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-300">Primary — active</span>
        </div>
      </div>

      {/* Fallback chain */}
      {chain.length > 0 && (
        <>
          <div className="ml-5 flex items-center gap-2">
            <ArrowDown className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Fallback chain (left to right)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {chain.map((entry, i) => (
              <div key={entry.model} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-[10px] font-bold text-violet-300">
                    {i + 1}
                  </div>
                  <ModelChip modelId={entry.model} />
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{entry.reason}</span>
                </div>
                {i < chain.length - 1 && <ArrowRight className="size-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModelCard({ model }: { model: ModelEntry }) {
  const providerColors: Record<string, string> = {
    minimax: "text-emerald-400 border-emerald-500/30",
    openai: "text-sky-400 border-sky-500/30",
  };
  const color = providerColors[model.provider] ?? "text-muted-foreground border-border/60";

  return (
    <div className={`rounded-lg border bg-background/35 p-4 ${color}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{model.name}</div>
          <div className="text-xs text-muted-foreground">{model.provider} · {model.id}</div>
        </div>
        {model.reasoning && (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            reasoning
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md border border-white/5 bg-white/5 px-2 py-1">
          <div className="text-muted-foreground">IN</div>
          <div className="font-medium">${model.inputCostPer1M}/1M</div>
        </div>
        <div className="rounded-md border border-white/5 bg-white/5 px-2 py-1">
          <div className="text-muted-foreground">OUT</div>
          <div className="font-medium">${model.outputCostPer1M}/1M</div>
        </div>
        <div className="col-span-2 rounded-md border border-white/5 bg-white/5 px-2 py-1">
          <div className="text-muted-foreground">Context</div>
          <div className="font-medium">{(model.contextWindow / 1024).toFixed(0)}k tokens</div>
        </div>
      </div>
    </div>
  );
}

export function ModelsClient() {
  const [state, setState] = useState<RoutingState>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) {
          setState({ loading: false, error: payload.error, data: null });
        } else {
          setState({ loading: false, error: null, data: payload as ModelRoutingViz });
        }
      })
      .catch((e: unknown) => setState({ loading: false, error: String(e), data: null }));
  }, []);

  if (state.loading) {
    return (
      <div className="dashboard-shell space-y-6">
        <SectionHeader title="Models" description="Model routing configuration and available models." />
        <div className="text-sm text-muted-foreground">Loading model routing data…</div>
      </div>
    );
  }

  if (state.error || !state.data) {
    return (
      <div className="dashboard-shell space-y-6">
        <SectionHeader title="Models" description="Model routing configuration and available models." />
        <div className="text-sm text-red-400">Error: {state.error ?? "No data"}</div>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Models"
        description={`Model routing visualization. ${data.configuredProviders.length} provider(s) configured.`}
      />

      {/* Routing Flow */}
      <Panel title="Routing Flow" description="Primary model and fallback chain.">
        <RoutingFlowDiagram primary={data.primaryModel} chain={data.fallbackChain} />
      </Panel>

      {/* Task Classification */}
      <Panel title="Task Classification" description="Model selection by task type.">
        <div className="space-y-2">
          {data.taskClassificationRules.map((rule) => (
            <div key={rule.taskType} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-sm">
              <span className="font-medium capitalize">{rule.taskType.replace(/-/g, " ")}</span>
              <div className="flex items-center gap-2">
                <ModelChip modelId={rule.model} />
                <ArrowRight className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">selected when</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Available Models */}
      {data.models.length > 0 && (
        <Panel title="Available Models" description={`${data.models.length} model(s) across ${data.configuredProviders.length} provider(s).`}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.models.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </div>
        </Panel>
      )}

      {/* Providers */}
      <Panel title="Configured Providers">
        <div className="flex flex-wrap gap-2">
          {data.configuredProviders.map((provider) => (
            <span key={provider} className="rounded-full border border-border/60 bg-background/35 px-3 py-1 text-sm font-medium">
              {provider}
            </span>
          ))}
        </div>
      </Panel>
    </div>
  );
}
