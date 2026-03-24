/* eslint-disable @typescript-eslint/no-explicit-any */
import {NextResponse} from 'next/server'
import {execSync} from 'child_process'

export async function POST(req:Request){
  const {prompt} = await req.json()
  if(!prompt) return NextResponse.json({error:'missing prompt'},{status:400})
  try{
    // Run local wrapper script if available
    const cmd = `/Users/nigel/.openclaw/workspace/obsidian-vault/bin/jarvis-cody.sh ${JSON.stringify(prompt)}`
    const out = execSync(cmd,{timeout:120000,encoding:'utf8'})
    return NextResponse.json({output: out})
  }catch(e:any){
    return NextResponse.json({error: String(e)},{status:500})
  }
}
