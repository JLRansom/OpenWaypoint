'use client'

import { useStream } from '@/components/StreamProvider'
import { AgentRow } from '@/components/AgentRow'

export function AgentList() {
  const agents = useStream()

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-700 py-16 text-center text-gray-500">
        No agents yet. Spawn one to get started.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-800 text-xs font-medium uppercase text-gray-400">
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
