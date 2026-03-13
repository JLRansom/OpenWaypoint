'use client'

import type { Meeting, MeetingStatus } from '@/lib/types'

const STATUS_STYLES: Record<MeetingStatus, { label: string; classes: string }> = {
  setup:             { label: 'Setup',     classes: 'text-dracula-comment bg-dracula-comment/10' },
  'writer-speaking': { label: 'Writer',    classes: 'text-dracula-purple bg-dracula-purple/10'   },
  discussion:        { label: 'Discussing', classes: 'text-dracula-cyan bg-dracula-cyan/10'     },
  concluded:         { label: 'Done',      classes: 'text-dracula-green bg-dracula-green/10'    },
}

function timeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function MeetingCard({
  meeting,
  onClick,
}: {
  meeting: Meeting
  onClick: () => void
}) {
  const statusInfo = STATUS_STYLES[meeting.status]

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-dracula-dark/60 rounded-xl p-4 hover:bg-dracula-dark/80 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusInfo.classes}`}
        >
          {statusInfo.label}
        </span>
        <span className="text-[10px] text-dracula-comment tabular-nums">
          {timeAgo(meeting.createdAt)}
        </span>
      </div>
      <p className="text-sm text-dracula-light line-clamp-2">{meeting.topic}</p>
    </button>
  )
}
