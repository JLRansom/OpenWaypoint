'use client'

import { useState, useEffect } from 'react'
import { Play, Calendar } from 'lucide-react'
import { useStream } from '@/components/StreamProvider'
import { MeetingCalendar } from '@/components/MeetingCalendar'
import { MeetingScheduleForm } from '@/components/MeetingScheduleForm'
import { ConcludedMeetingsList } from '@/components/ConcludedMeetingsList'
import { MeetingView } from '@/components/MeetingView'
import type { Meeting, MeetingSchedule } from '@/lib/types'

export function MeetingsPanel({ projectId }: { projectId: string }) {
  const stream = useStream()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [schedules, setSchedules] = useState<MeetingSchedule[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [starting, setStarting] = useState(false)

  // Initial REST fetch
  useEffect(() => {
    fetch(`/api/projects/${projectId}/meetings`)
      .then((r) => r.json())
      .then((data: Meeting[]) => setMeetings(data))
      .catch(console.error)

    fetch(`/api/projects/${projectId}/meeting-schedules`)
      .then((r) => r.json())
      .then((data: MeetingSchedule[]) => setSchedules(data))
      .catch(console.error)
  }, [projectId])

  // Merge SSE live meeting updates
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

  // Merge SSE schedule updates
  useEffect(() => {
    if (stream.meetingSchedules) {
      const projectSchedules = stream.meetingSchedules.filter((s) => s.projectId === projectId)
      setSchedules(projectSchedules)
    }
  }, [stream.meetingSchedules, projectId])

  async function startMeeting() {
    if (starting) return
    setStarting(true)
    try {
      // No topic — the writer agent analyzes the project and generates one
      const res = await fetch(`/api/projects/${projectId}/meetings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const meeting: Meeting = await res.json()
      setMeetings((prev) => [meeting, ...prev])
      setSelectedMeetingId(meeting.id)
    } catch (err) {
      console.error('Failed to create meeting:', err)
    } finally {
      setStarting(false)
    }
  }

  function handleScheduleCreated() {
    fetch(`/api/projects/${projectId}/meeting-schedules`)
      .then((r) => r.json())
      .then((data: MeetingSchedule[]) => setSchedules(data))
      .catch(console.error)
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
      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={startMeeting}
          disabled={starting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dracula-green/20 text-dracula-green text-xs font-semibold hover:bg-dracula-green/30 disabled:opacity-40 transition-colors"
        >
          <Play className="w-3 h-3" />
          {starting ? 'Creating...' : 'Start Meeting'}
        </button>
        <button
          onClick={() => setShowScheduleForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-dracula-purple/20 text-dracula-purple text-xs font-semibold hover:bg-dracula-purple/30 transition-colors"
        >
          <Calendar className="w-3 h-3" />
          Schedule Meetings
        </button>
        {schedules.length > 0 && (
          <span className="text-[10px] text-dracula-comment">
            {schedules.length} active schedule{schedules.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Calendar view */}
      <MeetingCalendar
        meetings={meetings}
        schedules={schedules}
        onMeetingClick={(id) => setSelectedMeetingId(id)}
      />

      {/* Concluded meetings list */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-3">
          Concluded Meetings
        </p>
        <ConcludedMeetingsList
          meetings={meetings}
          onClick={(id) => setSelectedMeetingId(id)}
        />
      </div>

      {/* Schedule creation modal */}
      {showScheduleForm && (
        <MeetingScheduleForm
          projectId={projectId}
          onCreated={handleScheduleCreated}
          onClose={() => setShowScheduleForm(false)}
        />
      )}
    </div>
  )
}
