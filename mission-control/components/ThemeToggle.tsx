"use client"
import {useEffect, useState} from 'react'

export default function ThemeToggle(){
  // lazy initializer reads localStorage on first render (client-only)
  const [light, setLight] = useState(()=>{
    try{ return localStorage.getItem('mc-theme') === 'light' }catch(e){ return false }
  })

  useEffect(()=>{
    try{
      if(light){
        document.documentElement.classList.remove('dark')
        localStorage.setItem('mc-theme','light')
      } else {
        document.documentElement.classList.add('dark')
        localStorage.setItem('mc-theme','dark')
      }
    }catch(e){}
  },[light])

  return (
    <button onClick={()=>setLight(prev=>!prev)} className="px-3 py-1 bg-gray-700 rounded text-sm">{light? 'Light' : 'Dark'}</button>
  )
}
