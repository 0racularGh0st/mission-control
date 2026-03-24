import fs from 'fs'
import path from 'path'

const STORE = path.resolve(process.cwd(), 'routing_logs.json')

export function appendLog(entry: any){
  let arr:any[] = []
  if(fs.existsSync(STORE)){
    try{ arr = JSON.parse(fs.readFileSync(STORE,'utf8')) }catch(e){ arr = [] }
  }
  arr.push(entry)
  fs.writeFileSync(STORE, JSON.stringify(arr, null, 2), 'utf8')
}

export function readLogs(){
  if(!fs.existsSync(STORE)) return []
  try{ return JSON.parse(fs.readFileSync(STORE,'utf8')) }catch(e){ return [] }
}
