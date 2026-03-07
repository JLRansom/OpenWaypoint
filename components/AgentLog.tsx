'use client'

import { useEffect, useRef } from 'react'
import { useStream } from '@/components/StreamProvider'
import { StatusBadge } from '@/components/StatusBadge'

export function AgentLog({ agentId }: { agentId: string }) {
  const { agents } = useStream()
  const agent = agents.find((a) => a.id === agentId)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agent?.events.length])

  if (!agent) {
    return <div className="text-dracula-blue text-sm">Loading agent...</div>
  }

  const fullText = agent.events.map((e) => e.text).join('')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <StatusBadge status={agent.status} />
        <span className="text-xs text-dracula-blue capitalize">{agent.type} agent</span>
        {agent.completedAt && (
          <span className="text-xs text-dracula-blue">
            Completed {new Date(agent.completedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="rounded-lg bg-dracula-dark border border-dracula-dark p-4">
        <p className="text-sm text-dracula-blue mb-3 font-medium">Prompt</p>
        <p className="text-sm text-dracula-light">{agent.prompt}</p>
      </div>

      {agent.error && (
        <div className="rounded-lg bg-dracula-red/10 border border-dracula-red p-4 text-sm text-dracula-red">
          {agent.error}
        </div>
      )}

      <div className="rounded-lg bg-dracula-surface border border-dracula-dark p-4 min-h-48 max-h-[60vh] overflow-y-auto font-mono text-sm text-dracula-light leading-relaxed whitespace-pre-wrap">
        {fullText || (
          <span className="text-dracula-blue">
            {agent.status === 'queued' ? 'Waiting to start...' : 'Running...'}
          </span>
        )}
        {agent.status === 'running' && (
          <span className="inline-block w-2 h-4 bg-dracula-purple ml-0.5 animate-pulse" />
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
