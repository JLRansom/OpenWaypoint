'use client'

import { useEffect, useRef } from 'react'
import { useStream } from '@/components/StreamProvider'
import { StatusBadge } from '@/components/StatusBadge'

export function AgentLog({ agentId }: { agentId: string }) {
  const agents = useStream()
  const agent = agents.find((a) => a.id === agentId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agent?.events.length])

  if (!agent) {
    return <div className="text-gray-400 text-sm">Loading agent...</div>
  }

  const fullText = agent.events.map((e) => e.text).join('')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={agent.status} />
        <span className="text-xs text-gray-400 capitalize">{agent.type} agent</span>
        {agent.completedAt && (
          <span className="text-xs text-gray-400">
            Completed {new Date(agent.completedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <p className="text-sm text-gray-500 mb-3 font-medium">Prompt</p>
        <p className="text-sm text-gray-700">{agent.prompt}</p>
      </div>

      {agent.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          {agent.error}
        </div>
      )}

      <div className="rounded-lg bg-gray-900 border border-gray-700 p-4 min-h-48 max-h-[60vh] overflow-y-auto font-mono text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
        {fullText || (
          <span className="text-gray-500">
            {agent.status === 'queued' ? 'Waiting to start...' : 'Running...'}
          </span>
        )}
        {agent.status === 'running' && (
          <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 animate-pulse" />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
