'use client'

import { useRef, useEffect } from 'react'
import type { MeetingMessage } from '@/lib/types'
import { ROLE_COLORS, ROLE_COLOR_FALLBACK } from '@/lib/constants'
import { formatTokens, formatCost } from '@/lib/format-utils'

export function MeetingChat({ messages }: { messages: MeetingMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const visibleMessages = messages.filter((m) => m.status !== 'pending')

  if (visibleMessages.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-dracula-comment italic">Waiting for meeting to start...</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {visibleMessages.map((msg) => (
        <div
          key={msg.id}
          className="bg-dracula-darker/80 backdrop-blur-sm rounded-xl p-4 border border-dracula-dark/50 transition-all"
        >
          {/* Header: role badge + speaking indicator */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                ROLE_COLORS[msg.agentType] ?? ROLE_COLOR_FALLBACK
              }`}
            >
              {msg.agentType}
            </span>
            {msg.status === 'speaking' && (
              <span className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-dracula-green animate-pulse" />
                <span className="text-[10px] text-dracula-green animate-pulse">speaking</span>
              </span>
            )}
            {msg.status === 'done' && (
              <span className="text-[10px] text-dracula-comment">done</span>
            )}
          </div>

          {/* Content */}
          <div className="text-sm text-dracula-light whitespace-pre-wrap leading-relaxed">
            {msg.content || (
              <span className="text-dracula-comment italic">Thinking...</span>
            )}
            {msg.status === 'speaking' && (
              <span className="inline-block animate-pulse ml-0.5 text-dracula-green">|</span>
            )}
          </div>

          {/* Per-message cost annotation */}
          {msg.status === 'done' && msg.costUsd != null && (
            <div className="flex gap-2 mt-1.5 text-[10px] text-dracula-comment/70">
              {msg.inputTokens != null && msg.outputTokens != null && (
                <span>{formatTokens(msg.inputTokens + msg.outputTokens)} tokens</span>
              )}
              <span>{formatCost(msg.costUsd)}</span>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
