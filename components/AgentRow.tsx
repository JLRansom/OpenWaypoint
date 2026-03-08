'use client'

import { Agent } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'
import { useStream } from '@/components/StreamProvider'
import { Button } from '@/components/ui/Button'

export function AgentRow({ agent }: { agent: Agent }) {
  const { projects } = useStream()
  const project = projects.find((p) => p.id === agent.projectId)

  async function handleStop() {
    await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
  }

  return (
    <tr className="border-b border-dracula-dark hover:bg-dracula-dark/30 transition-colors">
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
        {agent.status === 'running' && (
          <Button variant="danger" size="sm" onClick={handleStop}>
            Stop
          </Button>
        )}
      </td>
    </tr>
  )
}
