/* eslint-disable @typescript-eslint/no-explicit-any */
import {NextResponse} from 'next/server'
import fs from 'fs'
import path from 'path'

const STORE = path.resolve('/Users/nigel/.openclaw/workspace/obsidian-vault/tasks.json')

export async function GET(){
  try{
    const data = fs.existsSync(STORE)? fs.readFileSync(STORE,'utf8') : 'null'
    return NextResponse.json({tasks: data? JSON.parse(data): null})
  }catch(e:any){
    return NextResponse.json({error:String(e)},{status:500})
  }
}

export async function POST(req:Request){
  try{
    const body = await req.json()
    fs.writeFileSync(STORE, JSON.stringify(body.tasks||{} , null, 2), 'utf8')
    return NextResponse.json({ok:true})
  }catch(e:any){
    return NextResponse.json({error:String(e)},{status:500})
  }
}
