"use client";

import { useEffect, useState } from "react";

type Model = {
  id: string;
  tier: string;
  example_cost_per_1k: number;
};

type ModelsApiResponse = {
  models?: Model[];
  error?: string;
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((response) => response.json() as Promise<ModelsApiResponse>)
      .then((payload) => {
        if (payload.error) {
          setErr(payload.error);
          return;
        }
        setModels(payload.models ?? []);
      })
      .catch((error: unknown) => {
        setErr(error instanceof Error ? error.message : String(error));
      });
  }, []);

  if (err) {
    return <div className="p-6 text-red-400">Error: {err}</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">Available models (workspace)</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {models.map((model) => (
          <div key={model.id} className="panel rounded-2xl p-3">
            <div className="font-medium">{model.id}</div>
            <div className="text-muted text-sm">
              Tier: {model.tier} • cost: ${model.example_cost_per_1k}/1k
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
