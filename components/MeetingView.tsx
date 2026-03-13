'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useStream } from '@/components/StreamProvider'
import { MeetingChat } from '@/components/MeetingChat'
import type { Meeting, MeetingMessage } from '@/lib/types'
import { ChevronLeft, Play } from 'lucide-react'

// Dynamic import for three.js scene — code-split, no SSR
const MeetingScene = dynamic(
  () => import('@/components/MeetingScene').then((m) => ({ default: m.MeetingScene })),
  { ssr: false },
)

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
  const [starting, setStarting] = useState(false)

  // Initial REST fetch
  useEffect(() => {
    fetch(`/api/projects/${projectId}/meetings/${meetingId}`)
      .then((r) => r.json())
      .then((data: { meeting: Meeting; messages: MeetingMessage[] }) => {
        setMeeting(data.meeting)
        setMessages(data.messages)
      })
      .catch(console.error)
  }, [meetingId, projectId])

  // Merge live SSE updates
  useEffect(() => {
    const liveMeeting = stream.meetings?.find((m) => m.id === meetingId)
    if (liveMeeting) setMeeting(liveMeeting)

    const liveMessages = stream.meetingMessages?.filter((m) => m.meetingId === meetingId)
    if (liveMessages && liveMessages.length > 0) setMessages(liveMessages)
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

  return (
    <div className="relative min-h-[600px] rounded-xl overflow-hidden bg-dracula-darker border border-dracula-dark/50">
      {/* Three.js background */}
      <div className="absolute inset-0 pointer-events-none">
        <MeetingScene speakingAgent={speakingAgent} />
      </div>

      {/* UI overlay */}
      <div className="relative z-10 flex flex-col min-h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-dracula-darker/80 backdrop-blur-sm border-b border-dracula-dark/50">
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
                {meeting.status === 'concluded' ? 'Concluded' : isActive ? 'Live' : meeting.status}
              </span>
            )}
            {isActive && (
              <span className="inline-block w-2 h-2 rounded-full bg-dracula-green animate-pulse" />
            )}
          </div>
        </div>

        {/* Topic */}
        <div className="px-4 py-3 bg-dracula-darker/60 backdrop-blur-sm border-b border-dracula-dark/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-1">Topic</p>
          <p className="text-sm text-dracula-light">{meeting?.topic}</p>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto max-h-[500px]">
          <MeetingChat messages={messages} />
        </div>
      </div>
    </div>
  )
}
