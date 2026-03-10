'use client'

import { useEffect, useRef } from 'react'
import { X, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { isAgentActive } from '@/lib/types'
import type { Agent } from '@/lib/types'

const STATUS_COLORS: Record<string, string> = {
  running: 'text-dracula-green',
  queued:  'text-dracula-yellow',
  done:    'text-dracula-cyan',
  failed:  'text-dracula-red',
  idle:    'text-dracula-comment',
}

export function AgentTerminalModal({
  agent,
  onClose,
}: {
  agent: Agent | undefined
  onClose: () => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agent?.events.length])

  if (!agent) return null

  const text = agent.events.map((e) => e.text).join('')
  const isRunning = isAgentActive(agent)

  async function handleStop() {
    await fetch(`/api/agents/${agent!.id}`, { method: 'DELETE' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dracula-darker/80">
      <div className="flex flex-col w-full max-w-3xl max-h-[80vh] rounded-xl bg-dracula-surface border border-dracula-dark shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dracula-dark shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-dracula-comment">{agent.id.slice(0, 8)}</span>
            <span className="text-sm font-medium capitalize text-dracula-light">{agent.type}</span>
            <span className={`text-xs font-semibold uppercase ${STATUS_COLORS[agent.status] ?? 'text-dracula-light'}`}>
              {agent.status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <Button variant="danger" size="sm" onClick={handleStop}>
                <Square className="w-3 h-3 mr-1" /> Stop
              </Button>
            )}
            <button onClick={onClose} className="text-dracula-blue hover:text-dracula-light transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Terminal body */}
        <div className="flex-1 overflow-y-auto bg-dracula-darker p-4 font-mono text-xs text-dracula-light leading-relaxed whitespace-pre-wrap break-words">
          {text || <span className="text-dracula-comment italic">Waiting for output…</span>}
          {isRunning && <span className="animate-pulse ml-0.5 text-dracula-green">▋</span>}
          <div ref={bottomRef} />
        </div>

        {/* Prompt footer */}
        {agent.prompt && (
          <div className="px-4 py-2 border-t border-dracula-dark shrink-0">
            <p className="text-[10px] text-dracula-comment truncate">
              <span className="font-semibold">Prompt: </span>{agent.prompt}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
