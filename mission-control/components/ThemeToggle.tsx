"use client"
import {useEffect, useState} from 'react'

export default function ThemeToggle(){
  const [light, setLight] = useState(false)
  useEffect(()=>{
    const saved = localStorage.getItem('mc-theme')
    if(saved==='light') setLight(true)
    else setLight(false)
  },[])
  useEffect(()=>{
    if(light){
      document.documentElement.classList.remove('dark')
      localStorage.setItem('mc-theme','light')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('mc-theme','dark')
    }
  },[light])
  return (
    <button onClick={()=>setLight(!light)} className="px-3 py-1 bg-gray-700 rounded text-sm">{light? 'Light' : 'Dark'}</button>
  )
}
