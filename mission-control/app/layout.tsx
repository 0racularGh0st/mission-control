import './globals.css'
import {ReactNode} from 'react'
import Sidebar from '../components/Sidebar'
import fs from 'fs'
import path from 'path'
export const metadata = {
  title: 'Mission Control',
  description: 'Jarvis Mission Control'
}

const INLINE_CSS = (() => {
  try{
    const p = path.resolve(process.cwd(), 'app', 'globals.css')
    return fs.readFileSync(p,'utf8')
  }catch(e){
    return ''
  }
})()

export default function RootLayout({children}:{children:ReactNode}){
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{__html: INLINE_CSS}} />
      </head>
      <body className="bg-gray-900 text-gray-100">
        <div className="min-h-screen flex">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
