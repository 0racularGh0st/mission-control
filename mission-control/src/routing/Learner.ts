import { readLogs } from './Logger'

export type ModelStats = {
  success_rate:number,
  avg_cost:number,
  avg_latency:number,
  avg_quality:number,
  requests:number
}

export function computeStats(): Record<string, ModelStats>{
  const logs = readLogs()
  const per: Record<string, any[]> = {}
  for(const l of logs){
    const m = l.final_model || l.model_used
    per[m] = per[m]||[]
    per[m].push(l)
  }
  const res: Record<string, ModelStats> = {}
  for(const m of Object.keys(per)){
    const arr = per[m]
    const requests = arr.length
    const success_rate = arr.filter(x=>x.success).length/requests
    const avg_cost = arr.reduce((s,x)=>s+(x.cost||0),0)/requests
    const avg_latency = arr.reduce((s,x)=>s+(x.latency_ms||0),0)/requests
    const avg_quality = arr.reduce((s,x)=>s+(x.quality_score||0),0)/requests
    res[m]={ success_rate: Number(success_rate.toFixed(3)), avg_cost: Number(avg_cost.toFixed(6)), avg_latency: Math.round(avg_latency), avg_quality: Number((avg_quality/requests||0).toFixed(3)), requests }
  }
  return res
}
