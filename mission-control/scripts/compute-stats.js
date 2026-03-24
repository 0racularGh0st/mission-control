const fs = require('fs'); const path = require('path');
const STORE = path.resolve(process.cwd(),'routing_logs.json')
if(!fs.existsSync(STORE)){ console.log('{}'); process.exit(0) }
const logs = JSON.parse(fs.readFileSync(STORE,'utf8'))
const per = {}
for(const l of logs){ const m = l.final_model||l.model_used; per[m]=per[m]||[]; per[m].push(l) }
const res = {}
for(const m of Object.keys(per)){
  const arr=per[m]; const req=arr.length
  const success = arr.filter(x=>x.success).length/req
  const avg_cost=arr.reduce((s,x)=>s+(x.cost||0),0)/req
  const avg_latency=arr.reduce((s,x)=>s+(x.latency_ms||0),0)/req
  const avg_quality=arr.reduce((s,x)=>s+(x.quality_score||0),0)/req
  res[m]={ success_rate: Number(success.toFixed(3)), avg_cost: Number(avg_cost.toFixed(6)), avg_latency: Math.round(avg_latency), avg_quality: Number((avg_quality/req||0).toFixed(3)), requests:req }
}
console.log(JSON.stringify(res,null,2))
