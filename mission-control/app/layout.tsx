import './globals.css'
import {ReactNode} from 'react'
import Sidebar from '../components/Sidebar'
export const metadata = {
  title: 'Mission Control',
  description: 'Jarvis Mission Control'
}

export default function RootLayout({children}:{children:ReactNode}){
  return (
    <html lang="en">
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
