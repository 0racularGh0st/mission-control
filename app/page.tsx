import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'

export default function Page(){
  return (
    <div className="min-h-screen bg-jarvis p-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="text-2xl font-bold">Mission Control — Demo</div>
        <div className="flex items-center gap-3">
          <Input placeholder="Search commands (Cmd+K)" />
          <Button>Run</Button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Panel>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Active Agents</div>
              <div className="text-xs text-slate-400">Live</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card title="Agent A">Current task: research</Card>
              <Card title="Agent B">Current task: build</Card>
            </div>
          </Panel>

          <Panel>
            <div className="font-semibold mb-3">Activity Log</div>
            <div className="text-sm text-slate-400">[12:00] Agent A started task • [12:02] Agent B completed task</div>
          </Panel>
        </section>

        <aside className="space-y-6">
          <Card title="Metrics">Daily spend: $1.23</Card>
          <Card title="Inspector">Select an agent</Card>
        </aside>
      </main>
    </div>
  )
}
