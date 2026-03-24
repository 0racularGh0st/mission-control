export type ExecResult = {
  output: string,
  tokens: number,
  cost: number,
  latency_ms: number
}

// NOTE: For Phase 1 demo we simulate model responses and costs. In Phase 2 we will call OpenAI.
export async function runModel(model:string, prompt:string):Promise<ExecResult>{
  const start = Date.now()
  // Simulated behavior: cheap models are faster but sometimes fail for complex prompts
  const isCheap = model.includes('mini')
  const failChance = isCheap? 0.25 : (model.includes('codex')? 0.02 : 0.1)
  const success = Math.random() > failChance
  const output = success? `Result from ${model} for prompt: ${prompt.slice(0,80)}` : `ERROR: incomplete result from ${model}`
  const tokens = Math.floor(200 + Math.random()*800)
  const cost = model.includes('codex')? tokens*0.0006 : model.includes('gpt-5')? tokens*0.0002 : tokens*0.00005
  const latency_ms = isCheap? 300 + Math.random()*300 : 700 + Math.random()*800
  // simulate wait
  await new Promise(r=>setTimeout(r, Math.min(800, latency_ms)))
  return { output, tokens, cost: Number(cost.toFixed(6)), latency_ms: Math.round(latency_ms) }
}
