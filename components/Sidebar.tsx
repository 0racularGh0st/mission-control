"use client"
import Link from 'next/link'
import ThemeToggle from './ThemeToggle'

export default function Sidebar(){
  return (
    <aside className="w-72 bg-gradient-to-b from-gray-800 via-gray-900 to-black border-r border-gray-700 p-4">
      <div className="text-2xl font-extrabold tracking-tight">Mission Control</div>
      <nav className="mt-6">
        <ul className="space-y-2">
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/dashboard">Dashboard</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/tasks">Tasks</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/agents">Agents</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/approvals">Approvals</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/calendar">Calendar</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/projects">Projects</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/memory">Memory</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/docs">Docs</Link></li>
          <li className="py-2 px-3 rounded hover:bg-gray-700"><Link href="/office">Office</Link></li>
        </ul>
      </nav>
      <div className="mt-8">
        <ThemeToggle />
      </div>
    </aside>
  )
}
