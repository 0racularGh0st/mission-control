#!/usr/bin/env ts-node
import { runTask } from '../src/routing/RouteManager'
import { appendLog } from '../src/routing/Logger'

async function demo(){
  const sampleTasks = [
    { task_id: 't1', type:'chat', text:'Summarize this text: Hello world', complexity:'low' },
    { task_id: 't2', type:'research', text:'Explain strategies for X', complexity:'medium' },
    { task_id: 't3', type:'code', text:'Implement API endpoint to do Y across multiple files', complexity:'high', multi_file:true },
    { task_id: 't4', type:'code', text:'Fix minor bug in helper', complexity:'medium' }
  ]

  for(const t of sampleTasks){
    console.log('\n=== Running task', t.task_id)
    const res = await runTask(t as any)
    console.log('Result:', res.result.evalr)
    console.log('Stats snapshot:', res.stats)
  }
  console.log('\nDemo finished. Logs saved to routing_logs.json')
}

demo().catch(e=>{ console.error(e); process.exit(1) })
