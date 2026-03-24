"use client"
import React, {createContext, useContext, useEffect, useState} from 'react'

type Theme = 'light'|'dark'|'system'
const STORAGE_KEY = 'mc:theme'

const ThemeContext = createContext<{theme:Theme,setTheme:(t:Theme)=>void,toggle:()=>void}|undefined>(undefined)

export const ThemeProvider:React.FC<{children:React.ReactNode}> = ({children})=>{
  const [theme,setThemeState] = useState<Theme>(()=>{
    try{ const s = localStorage.getItem(STORAGE_KEY) as Theme|null; return s||'system' }catch(e){ return 'system' }
  })

  useEffect(()=>{
    const apply = (t:Theme)=>{
      let resolved = t
      if(t==='system'){
        const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        resolved = prefersDark? 'dark':'light'
      }
      document.documentElement.setAttribute('data-theme', resolved)
    }
    apply(theme)
  },[theme])

  const setTheme = (t:Theme) =>{
    try{ localStorage.setItem(STORAGE_KEY,t) }catch(e){}
    setThemeState(t)
  }
  const toggle = ()=> setTheme(theme==='dark'?'light':'dark')

  return <ThemeContext.Provider value={{theme,setTheme,toggle}}>{children}</ThemeContext.Provider>
}

export const useTheme = ()=>{
  const ctx = useContext(ThemeContext)
  if(!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
