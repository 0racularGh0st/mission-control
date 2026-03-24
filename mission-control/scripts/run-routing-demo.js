const fs = require('fs')
const path = require('path')
const STORE = path.resolve(process.cwd(),'routing_logs.json')

function append(entry){
  let arr = []
  if(fs.existsSync(STORE)){
    try{ arr = JSON.parse(fs.readFileSync(STORE,'utf8')) }catch(e){ arr = [] }
  }
  arr.push(entry)
  fs.writeFileSync(STORE, JSON.stringify(arr,null,2),'utf8')
}

function simulatedRun(model, task){
  const isCheap = model.includes('mini')
  const failChance = isCheap? 0.25 : (model.includes('codex')? 0.02 : 0.1)
  const success = Math.random() > failChance
  const output = success? `Result from ${model} for task ${task}` : `ERROR from ${model}`
  const tokens = Math.floor(200 + Math.random()*800)
  const cost = model.includes('codex')? tokens*0.0006 : model.includes('gpt-5')? tokens*0.0002 : tokens*0.00005
  const latency_ms = isCheap? 200 + Math.random()*300 : 700 + Math.random()*800
  return {output,tokens,cost:Number(cost.toFixed(6)),latency_ms:Math.round(latency_ms),success}
}

async function demo(){
  const tasks = [
    {id:'t1',type:'chat',text:'Summarize text',complexity:'low'},
    {id:'t2',type:'research',text:'Explain X',complexity:'medium'},
    {id:'t3',type:'code',text:'Implement multi-file',complexity:'high'}
  ]
  const ROUTES = { cheap:'gpt-5-mini', mid:'gpt-5', heavy:'gpt-5.2-codex' }

  for(const t of tasks){
    let category = t.complexity==='low'?'cheap':(t.complexity==='medium'?'mid':'heavy')
    let model = ROUTES[category]
    let retry = 0
    let maxEsc=2
    while(true){
      const r = simulatedRun(model,t.text)
      const payload = {
        task: t.text, task_id: t.id, category, model_used:model, success:r.success, quality_score: r.success? (6+Math.floor(Math.random()*4)) : (1+Math.floor(Math.random()*3)), retry_count: retry, final_model: model, cost: r.cost, latency_ms:r.latency_ms, timestamp: new Date().toISOString(), features: t
      }
      append(payload)
      console.log('Task',t.id,'model',model,'success',r.success,'cost',r.cost)
      if(r.success) break
      if(retry>=maxEsc) break
      retry++
      if(model===ROUTES.cheap) model=ROUTES.mid
      else if(model===ROUTES.mid) model=ROUTES.heavy
      else break
    }
  }
  console.log('Demo finished. Logs written to routing_logs.json')
}

demo()
