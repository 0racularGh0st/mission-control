import React from 'react'

export function Panel({ children, className='' }: { children?: React.ReactNode, className?: string }){
  return <div className={"panel rounded-2xl p-4 " + className}>{children}</div>
}

export default Panel
