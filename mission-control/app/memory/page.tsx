import fs from 'fs'
import path from 'path'

export default function Memory(){
  const vault = path.resolve('/Users/nigel/.openclaw/workspace/obsidian-vault')
  let days: string[] = []
  try { days = fs.readdirSync(path.join(vault,'daily')).filter(f=>f.endsWith('.md')) } catch(e){}
  return (
    <div>
      <h1 className="text-3xl font-bold">Memory</h1>
      <ul className="mt-4 list-disc pl-6">
        {days.map(d=> <li key={d}>{d}</li>)}
      </ul>
    </div>
  )
}
