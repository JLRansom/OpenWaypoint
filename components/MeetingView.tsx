'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useStream } from '@/components/StreamProvider'
import { MeetingChat } from '@/components/MeetingChat'
import type { Meeting, MeetingMessage } from '@/lib/types'
import { ChevronLeft, Play } from 'lucide-react'
import { formatCost, formatTokens } from '@/lib/format-utils'
import { ROLE_HEX } from '@/lib/constants'

// Dynamic import for three.js scene — code-split, no SSR
const MeetingScene = dynamic(
  () => import('@/components/MeetingScene').then((m) => ({ default: m.MeetingScene })),
  { ssr: false },
)

interface MeetingDetailResponse {
  meeting: Meeting
  messages: MeetingMessage[]
  totalCostUsd: number
  totalTokens: number
}

export function MeetingView({
  meetingId,
  projectId,
  onBack,
}: {
  meetingId: string
  projectId: string
  onBack: () => void
}) {
  const stream = useStream()
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [messages, setMessages] = useState<MeetingMessage[]>([])
  const [totalCostUsd, setTotalCostUsd] = useState<number>(0)
  const [totalTokens, setTotalTokens] = useState<number>(0)
  const [starting, setStarting] = useState(false)

  // Initial REST fetch
  useEffect(() => {
    fetch(`/api/projects/${projectId}/meetings/${meetingId}`)
      .then((r) => r.json())
      .then((data: MeetingDetailResponse) => {
        setMeeting(data.meeting)
        setMessages(data.messages)
        setTotalCostUsd(data.totalCostUsd ?? 0)
        setTotalTokens(data.totalTokens ?? 0)
      })
      .catch(console.error)
  }, [meetingId, projectId])

  // Merge live SSE updates
  useEffect(() => {
    const liveMeeting = stream.meetings?.find((m) => m.id === meetingId)
    if (liveMeeting) setMeeting(liveMeeting)

    const liveMessages = stream.meetingMessages?.filter((m) => m.meetingId === meetingId)
    if (liveMessages && liveMessages.length > 0) {
      setMessages(liveMessages)
      setTotalCostUsd(liveMessages.reduce((s, m) => s + (m.costUsd ?? 0), 0))
      setTotalTokens(liveMessages.reduce((s, m) => s + (m.inputTokens ?? 0) + (m.outputTokens ?? 0), 0))
    }
  }, [stream.meetings, stream.meetingMessages, meetingId])

  const speakingAgent = messages.find((m) => m.status === 'speaking')?.agentType ?? null

  async function startMeeting() {
    if (starting) return
    setStarting(true)
    try {
      await fetch(`/api/projects/${projectId}/meetings/${meetingId}/start`, {
        method: 'POST',
      })
    } catch (err) {
      console.error('Failed to start meeting:', err)
      setStarting(false)
    }
  }

  const isActive = meeting && meeting.status !== 'setup' && meeting.status !== 'concluded'
  const isConcluded = meeting?.status === 'concluded'

  return (
    <div className="flex flex-row rounded-xl overflow-hidden border border-dracula-dark/50 min-h-[600px]">
      {/* Left pane — Three.js scene (45%) */}
      <div className="w-[45%] min-h-[600px] flex-shrink-0" style={{ background: '#1e1f29' }}>
        <MeetingScene speakingAgent={speakingAgent} messages={messages} />
      </div>

      {/* Right pane — header + topic + chat + cost footer (55%) */}
      <div className="flex flex-col w-[55%] bg-dracula-darker border-l border-dracula-dark/50">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-dracula-darker/80 backdrop-blur-sm border-b border-dracula-dark/50 flex-shrink-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-dracula-cyan hover:text-dracula-light transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            Back
          </button>

          <div className="flex items-center gap-3">
            {meeting?.status === 'setup' && (
              <button
                onClick={startMeeting}
                disabled={starting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dracula-green/20 text-dracula-green text-xs font-semibold hover:bg-dracula-green/30 disabled:opacity-40 transition-colors"
              >
                <Play className="w-3 h-3" />
                {starting ? 'Starting...' : 'Start Meeting'}
              </button>
            )}
            {meeting && (
              <span className="text-[10px] font-semibold text-dracula-comment uppercase tracking-widest">
                {isConcluded ? 'Concluded' : isActive ? 'Live' : meeting.status}
              </span>
            )}
            {isActive && (
              <span className="inline-block w-2 h-2 rounded-full bg-dracula-green animate-pulse" />
            )}
          </div>
        </div>

        {/* Topic */}
        <div className="px-4 py-3 bg-dracula-darker/60 backdrop-blur-sm border-b border-dracula-dark/30 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-1">Topic</p>
          <p className="text-sm text-dracula-light">{meeting?.topic ?? '—'}</p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto">
          <MeetingChat messages={messages} />
        </div>

        {/* Cost summary for concluded meetings */}
        {isConcluded && (totalCostUsd > 0 || totalTokens > 0) && (
          <div className="px-4 py-3 bg-dracula-darker/80 backdrop-blur-sm border-t border-dracula-dark/50 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-2">Meeting Cost</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
              {totalCostUsd > 0 && (
                <span className="text-xs text-dracula-green font-semibold">{formatCost(totalCostUsd)} total</span>
              )}
              {totalTokens > 0 && (
                <span className="text-xs text-dracula-comment">{formatTokens(totalTokens)} tokens</span>
              )}
            </div>
            {/* Per-agent cost row */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
              {messages.filter((m) => m.status === 'done' && m.costUsd != null).map((m) => (
                <span key={m.id} className="text-[10px] text-dracula-comment">
                  <span style={{ color: ROLE_HEX[m.agentType] ?? '#6272a4' }}>{m.agentType}</span>
                  {' '}{formatCost(m.costUsd!)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
