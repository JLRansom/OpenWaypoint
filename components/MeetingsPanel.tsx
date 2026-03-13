'use client'

import { useState, useEffect } from 'react'
import { useStream } from '@/components/StreamProvider'
import { MeetingCard } from '@/components/MeetingCard'
import { MeetingView } from '@/components/MeetingView'
import type { Meeting } from '@/lib/types'

export function MeetingsPanel({ projectId }: { projectId: string }) {
  const stream = useStream()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [newTopic, setNewTopic] = useState('')
  const [creating, setCreating] = useState(false)

  // Initial REST fetch of meetings for this project
  useEffect(() => {
    fetch(`/api/projects/${projectId}/meetings`)
      .then((r) => r.json())
      .then((data: Meeting[]) => setMeetings(data))
      .catch(console.error)
  }, [projectId])

  // Merge SSE updates for live meetings
  useEffect(() => {
    if (stream.meetings) {
      const projectMeetings = stream.meetings.filter((m) => m.projectId === projectId)
      if (projectMeetings.length > 0) {
        setMeetings((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]))
          for (const m of projectMeetings) map.set(m.id, m)
          return [...map.values()].sort((a, b) => b.createdAt - a.createdAt)
        })
      }
    }
  }, [stream.meetings, projectId])

  async function createMeeting() {
    if (!newTopic.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newTopic.trim() }),
      })
      const meeting: Meeting = await res.json()
      setMeetings((prev) => [meeting, ...prev])
      setNewTopic('')
      setSelectedMeetingId(meeting.id)
    } catch (err) {
      console.error('Failed to create meeting:', err)
    } finally {
      setCreating(false)
    }
  }

  if (selectedMeetingId) {
    return (
      <MeetingView
        meetingId={selectedMeetingId}
        projectId={projectId}
        onBack={() => setSelectedMeetingId(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* New Meeting form */}
      <div className="bg-dracula-dark/60 rounded-xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-3">
          New Meeting
        </p>
        <div className="flex gap-2">
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Propose an idea for the team to discuss..."
            className="flex-1 bg-dracula-darker border border-dracula-dark rounded-lg px-3 py-2 text-sm text-dracula-light placeholder:text-dracula-comment focus:outline-none focus:border-dracula-purple transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && createMeeting()}
          />
          <button
            onClick={createMeeting}
            disabled={!newTopic.trim() || creating}
            className="px-4 py-2 rounded-lg bg-dracula-purple/20 text-dracula-purple text-sm font-semibold hover:bg-dracula-purple/30 disabled:opacity-40 transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Meetings list */}
      <div className="space-y-3">
        {meetings.map((meeting) => (
          <MeetingCard
            key={meeting.id}
            meeting={meeting}
            onClick={() => setSelectedMeetingId(meeting.id)}
          />
        ))}
        {meetings.length === 0 && (
          <p className="text-sm text-dracula-comment">
            No meetings yet. Create one above to start a team discussion.
          </p>
        )}
      </div>
    </div>
  )
}
