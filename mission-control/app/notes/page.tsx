import fs from 'fs'
import path from 'path'

export default function Notes(){
  const vault = path.resolve('/Users/nigel/.openclaw/workspace/obsidian-vault')
  let files: string[] = []
  try { files = fs.readdirSync(vault).filter(f=>f.endsWith('.md')) } catch(e){}
  return (
    <div className="min-h-screen p-6">
      <h2 className="text-3xl font-semibold">Notes</h2>
      <ul className="mt-4 list-disc pl-6">
        {files.map(f=> <li key={f}>{f}</li>)}
      </ul>
    </div>
  )
}
