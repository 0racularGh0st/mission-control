import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(){
  try{
    const p = path.resolve('/Users/nigel/.openclaw/workspace/config/models.json');
    if(!fs.existsSync(p)) return NextResponse.json({ error: 'models config not found' }, { status: 404 });
    const raw = fs.readFileSync(p,'utf8');
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  }catch(e){
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
