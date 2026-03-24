"use client";
import React, { useEffect, useState } from 'react';

export default function ModelsPage(){
  const [models, setModels] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(()=>{
    fetch('/api/models').then(r=>r.json()).then(j=>{
      if(j.error) setErr(j.error);
      else setModels(j.models || []);
    }).catch(e=>setErr(String(e)));
  },[]);

  if(err) return <div className="p-6 text-red-400">Error: {err}</div>;
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">Available models (workspace)</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {models.map((m:any)=> (
          <div key={m.id} className="panel p-3 rounded-2xl">
            <div className="font-medium">{m.id}</div>
            <div className="text-sm text-slate-400">Tier: {m.tier} • cost: ${m.example_cost_per_1k}/1k</div>
          </div>
        ))}
      </div>
    </div>
  );
}
