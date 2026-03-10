'use client'

import { Agent } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'
import { useStream } from '@/components/StreamProvider'
import { Button } from '@/components/ui/Button'
import { Trash2 } from 'lucide-react'

export function AgentRow({ agent, onSelect }: { agent: Agent; onSelect: () => void }) {
  const { projects } = useStream()
  const project = projects.find((p) => p.id === agent.projectId)

  async function handleStop() {
    await fetch(`/api/agents/${agent.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
  }

  async function handleDelete() {
    if (!window.confirm('Delete this agent permanently? This cannot be undone.')) return
    await fetch(`/api/agents/${agent.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' }),
    })
  }

  const isDeletable = agent.status === 'idle' || agent.status === 'done' || agent.status === 'failed'

  return (
    <tr
      className="border-b border-dracula-dark hover:bg-dracula-dark/30 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <td className="py-3 px-4 font-mono text-xs text-dracula-blue">{agent.id.slice(0, 8)}</td>
      <td className="py-3 px-4">
        <span className="rounded bg-dracula-dark px-2 py-0.5 text-xs font-medium text-dracula-light capitalize">
          {agent.type}
        </span>
      </td>
      <td className="py-3 px-4 text-sm text-dracula-light/80">
        {project ? project.name : <span className="text-dracula-comment text-xs">—</span>}
      </td>
      <td className="py-3 px-4">
        <StatusBadge status={agent.status} />
      </td>
      <td className="py-3 px-4 text-xs text-dracula-blue">
        {new Date(agent.createdAt).toLocaleTimeString()}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {agent.status === 'running' && (
            <Button variant="danger" size="sm" onClick={handleStop}>
              Stop
            </Button>
          )}
          {isDeletable && (
            <Button variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
