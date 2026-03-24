// Phase 1: simple evaluator stub (replace with gpt-5-mini prompt wrapper later)
export async function evaluate(task:string, output:string){
  // crude heuristics: if output contains ERROR treat as fail, otherwise success
  const success = !/ERROR/i.test(output)
  const quality = success? (6 + Math.floor(Math.random()*4)) : (1 + Math.floor(Math.random()*3))
  const issues = success? [] : ['incomplete output']
  const confidence = success? 0.7 + Math.random()*0.3 : 0.4 + Math.random()*0.4
  return { success, quality_score: quality, errors: issues, confidence: Number(confidence.toFixed(2)) }
}
