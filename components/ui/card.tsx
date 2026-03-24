import React from 'react'
import { Card as ShadCard, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/card'

export function Card({ title, children, footer }: { title?: string, children?: React.ReactNode, footer?: React.ReactNode }){
  // Use shadcn Card if available, otherwise fallback
  if(ShadCard){
    return (
      <ShadCard>
        {title && <CardHeader><CardTitle>{title}</CardTitle></CardHeader>}
        <CardContent>{children}</CardContent>
        {footer && <CardFooter>{footer}</CardFooter>}
      </ShadCard>
    )
  }
  return (
    <div className="panel rounded-2xl p-4">
      {title && <div className="font-semibold mb-2">{title}</div>}
      <div>{children}</div>
      {footer && <div className="mt-3 text-sm text-slate-400">{footer}</div>}
    </div>
  )
}

export default Card
