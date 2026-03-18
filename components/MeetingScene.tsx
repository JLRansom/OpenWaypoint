'use client'

// THREE.JS TEMPORARILY DISABLED — diagnostic stub to isolate compile-time regression.
// Replace this file with the full implementation once the cause is confirmed.

import type { MeetingMessage } from '@/lib/types'

export function MeetingScene({
  speakingAgent,
  messages: _messages,
}: {
  speakingAgent: string | null
  messages: MeetingMessage[]
}) {
  return (
    <div
      style={{ background: '#1e1f29', width: '100%', height: '100%' }}
      className="flex items-center justify-center text-dracula-comment text-sm"
    >
      3D scene disabled (diagnostic)
      {speakingAgent && <span className="ml-2 text-dracula-cyan">{speakingAgent}</span>}
    </div>
  )
}
