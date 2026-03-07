'use client'

import { Bot } from 'lucide-react'
import { useStream } from '@/components/StreamProvider'
import { AgentRow } from '@/components/AgentRow'

export function AgentList() {
  const { agents } = useStream()

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-dracula-dark py-24 flex flex-col items-center gap-3 text-center">
        <Bot className="w-10 h-10 text-dracula-dark" />
        <p className="text-dracula-blue text-sm font-medium">No agents yet</p>
        <p className="text-dracula-blue/60 text-xs">Hit &quot;+ New Agent&quot; to spawn your first one.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-dracula-dark">
      <table className="w-full text-left text-sm">
        <thead className="bg-dracula-dark text-xs font-medium uppercase text-dracula-blue">
          <tr>
            <th className="py-3 px-4">ID</th>
            <th className="py-3 px-4">Type</th>
            <th className="py-3 px-4">Prompt</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Created</th>
            <th className="py-3 px-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
