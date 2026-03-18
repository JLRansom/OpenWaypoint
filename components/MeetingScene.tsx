'use client'

import { ROLE_HEX, ROLE_HEX_FALLBACK } from '@/lib/constants'
import type { MeetingMessage } from '@/lib/types'

export function MeetingScene({
  speakingAgent,
  messages,
}: {
  speakingAgent: string | null
  messages: MeetingMessage[]
}) {
  const spokenAgents = new Set(
    messages.filter((m) => m.status === 'done').map((m) => m.agentType),
  )

  return (
    <div
      className="flex flex-col items-center justify-center w-full h-full gap-6 p-6"
      style={{ background: '#1e1f29' }}
    >
      {/* Row 1: writer, researcher, coder */}
      <div className="flex items-center justify-center gap-8">
        {(['writer', 'researcher', 'coder'] as const).map((role) => (
          <AgentCircle
            key={role}
            role={role}
            speaking={speakingAgent === role}
            spoken={spokenAgents.has(role)}
          />
        ))}
      </div>
      {/* Row 2: senior-coder, tester */}
      <div className="flex items-center justify-center gap-8">
        {(['senior-coder', 'tester'] as const).map((role) => (
          <AgentCircle
            key={role}
            role={role}
            speaking={speakingAgent === role}
            spoken={spokenAgents.has(role)}
          />
        ))}
      </div>
    </div>
  )
}

function AgentCircle({
  role,
  speaking,
  spoken,
}: {
  role: string
  speaking: boolean
  spoken: boolean
}) {
  const color = ROLE_HEX[role] ?? ROLE_HEX_FALLBACK

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Pulse ring for speaking agent */}
        {speaking && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: color, opacity: 0.35 }}
          />
        )}
        {/* Agent circle */}
        <div
          className="relative w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: `${color}22`,
            border: `2px solid ${speaking ? color : `${color}66`}`,
            boxShadow: speaking ? `0 0 12px ${color}88` : undefined,
            color,
          }}
        >
          {spoken && !speaking ? (
            <span className="text-base">✓</span>
          ) : (
            <span>{role.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>
      <span
        className="text-[10px] font-semibold tracking-wide"
        style={{ color: speaking ? color : `${color}99` }}
      >
        {role}
      </span>
    </div>
  )
}
