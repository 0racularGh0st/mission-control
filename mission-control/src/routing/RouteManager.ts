import { runModel } from './ModelExecutor'
import { evaluate } from './Evaluator'
import { appendLog } from './Logger'
import { computeStats } from './Learner'

export type Task = { task_id:string, type:string, text:string, complexity:string, multi_file?:boolean }

const ROUTES = {
  cheap: 'openai/gpt-5-mini',
  mid: 'openai/gpt-5',
  heavy: 'openai/gpt-5.2-codex'
}

export async function classify(task:Task):Promise<'cheap'|'mid'|'heavy'>{
  // naive: map by type/complexity
  if(task.type==='chat' || task.complexity==='low') return 'cheap'
  if(task.type==='research' || task.complexity==='medium') return 'mid'
  return 'heavy'
}

export async function runTask(task:Task){
  const category = await classify(task)
  const initialModel = ROUTES[category]
  let attempt = 0
  let model = initialModel
  let lastResult:any = null
  let retryCount = 0
  const maxEscalations = 2

  while(true){
    attempt++
    const exec = await runModel(model, task.text)
    const evalr = await evaluate(task.text, exec.output)
    const log = {
      task: task.text,
      task_id: task.task_id,
      category,
      model_used: model,
      success: evalr.success,
      quality_score: evalr.quality_score,
      retry_count: retryCount,
      final_model: model,
      cost: exec.cost,
      latency_ms: exec.latency_ms,
      timestamp: new Date().toISOString(),
      features: task
    }
    appendLog(log)
    lastResult = { exec, evalr, log }
    if(evalr.success) break

    // escalation logic
    if(retryCount >= maxEscalations) break
    retryCount++
    if(model===ROUTES.cheap) model = ROUTES.mid
    else if(model===ROUTES.mid) model = ROUTES.heavy
    else break
  }

  const stats = computeStats()
  return { result:lastResult, stats }
}
