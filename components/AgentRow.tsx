'use client'

import { useRouter } from 'next/navigation'
import { Agent } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'

export function AgentRow({ agent }: { agent: Agent }) {
  const router = useRouter()

  async function handleStop() {
    await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
  }

  async function handleRetry() {
    await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: agent.type, prompt: agent.prompt }),
    })
  }

  return (
    <tr className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
      <td className="py-3 px-4 font-mono text-xs text-gray-500">{agent.id.slice(0, 8)}</td>
      <td className="py-3 px-4">
        <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-300 capitalize">
          {agent.type}
        </span>
      </td>
      <td className="py-3 px-4 max-w-xs truncate text-sm text-gray-300">{agent.prompt}</td>
      <td className="py-3 px-4">
        <StatusBadge status={agent.status} />
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">
        {new Date(agent.createdAt).toLocaleTimeString()}
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/agents/${agent.id}`)}
            className="text-xs text-blue-400 hover:underline"
          >
            View
          </button>
          {agent.status === 'running' && (
            <button
              onClick={handleStop}
              className="text-xs text-red-400 hover:underline"
            >
              Stop
            </button>
          )}
          {(agent.status === 'done' || agent.status === 'failed') && (
            <button
              onClick={handleRetry}
              className="text-xs text-gray-500 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
