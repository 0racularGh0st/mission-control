import './globals.css'
import './styles/tokens.css'
import {ReactNode} from 'react'
import Sidebar from '../components/Sidebar'
import { ThemeProvider } from '../src/components/ThemeProvider'
export const metadata = {
  title: 'Mission Control',
  description: 'Jarvis Mission Control'
}

export default function RootLayout({children}:{children:ReactNode}){
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text">
        <ThemeProvider>
          <div className="min-h-screen flex">
            <Sidebar />
            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
