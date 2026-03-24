import React from 'react'
import { Input as ShadInput } from '../../components/ui/input'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>){
  if(ShadInput) return <ShadInput {...props} />
  return <input {...props} className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.03)] rounded-xl p-3 text-sm w-full" />
}

export default Input
