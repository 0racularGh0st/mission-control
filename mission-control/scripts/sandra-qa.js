const fetch = globalThis.fetch || ((url)=>{ throw new Error('global fetch not available') })

async function check(url, contains){
  try{
    const res = await fetch(url)
    const text = await res.text()
    const ok = text.includes(contains)
    console.log(`${url} -> contains '${contains}': ${ok}`)
    return ok
  }catch(e){ console.log('ERR',url,e); return false }
}

async function run(){
  const base = 'http://localhost:3003'
  const checks = [
    {url: base, contains: 'Mission Control'},
    {url: base + '/tasks', contains: 'Tasks'},
    {url: base + '/agents', contains: 'Agents'},
    {url: base + '/office', contains: 'Office'}
  ]
  const results = []
  for(const c of checks){
    const ok = await check(c.url, c.contains)
    results.push({ ...c, ok })
  }
  const failed = results.filter(r=>!r.ok)
  if(failed.length) console.log('Sandra QA: FAIL', failed)
  else console.log('Sandra QA: ALL OK')
}

run()
