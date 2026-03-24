use client

import { ReactNode, useEffect, useState } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }){
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    try{
      const stored = localStorage.getItem('theme')
      if (stored === 'dark') return 'dark'
    }catch(e){}
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light')
    try{ localStorage.setItem('theme', theme) }catch(e){}
  },[theme])

  return (
    <div>
      <button
        aria-label="Toggle theme"
        onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        className="sr-only"
      >
        Toggle theme
      </button>
      {children}
    </div>
  )
}
