import fs from 'fs'
import path from 'path'

export default function Docs(){
  const docsDir = path.resolve('/Users/nigel/.openclaw/workspace/docs')
  let files: string[] = []
  try { files = fs.readdirSync(docsDir).filter(f=>f.endsWith('.md')) } catch(e){}
  return (
    <div>
      <h1 className="text-3xl font-bold">Docs</h1>
      <ul className="mt-4 list-disc pl-6">
        {files.map(f=> <li key={f}>{f}</li>)}
      </ul>
    </div>
  )
}
