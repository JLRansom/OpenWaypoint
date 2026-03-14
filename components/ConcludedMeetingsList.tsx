'use client'

import type { Meeting } from '@/lib/types'
import { formatCost, formatTokens, formatDuration } from '@/lib/format-utils'

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ConcludedMeetingsList({
  meetings,
  onClick,
}: {
  meetings: Meeting[]
  onClick: (meetingId: string) => void
}) {
  const concluded = meetings
    .filter((m) => m.status === 'concluded')
    .sort((a, b) => b.createdAt - a.createdAt)

  if (concluded.length === 0) {
    return (
      <p className="text-sm text-dracula-comment">
        No concluded meetings yet. Start one and watch the agents discuss!
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {concluded.map((meeting) => (
        <button
          key={meeting.id}
          onClick={() => onClick(meeting.id)}
          className="w-full text-left bg-dracula-dark/60 rounded-xl p-3 hover:bg-dracula-dark/80 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-dracula-light line-clamp-1 font-medium">{meeting.topic}</p>
              <p className="text-[10px] text-dracula-comment mt-0.5">{formatDate(meeting.createdAt)}</p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full text-dracula-green bg-dracula-green/10">
              Done
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
