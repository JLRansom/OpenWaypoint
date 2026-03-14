'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Meeting, MeetingSchedule } from '@/lib/types'
import { getNextCronRuns } from '@/lib/cron-utils'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  meetings: Meeting[]
  scheduledRuns: number // count of scheduled (future) runs on this day
}

function getCalendarDays(year: number, month: number, meetings: Meeting[], schedules: MeetingSchedule[]): CalendarDay[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // First day of the month (0 = Sunday, 1 = Monday...)
  const firstDay = new Date(year, month, 1)
  // Adjust so week starts on Monday: Sunday (0) → 6, Monday (1) → 0, etc.
  const startDow = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  // Pre-compute meeting dates (keyed by YYYY-MM-DD)
  const meetingsByDate = new Map<string, Meeting[]>()
  for (const m of meetings) {
    const d = new Date(m.createdAt)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const existing = meetingsByDate.get(key) ?? []
    existing.push(m)
    meetingsByDate.set(key, existing)
  }

  // Pre-compute future scheduled runs for the displayed 6-week window
  const windowStart = new Date(year, month, 1 - startDow)
  const windowEnd = new Date(year, month, 1 - startDow + 41) // 6 weeks
  const scheduledByDate = new Map<string, number>()
  for (const s of schedules) {
    if (!s.enabled) continue
    const runs = getNextCronRuns(s.cronExpression, 60, windowStart.getTime())
    for (const runMs of runs) {
      if (runMs > windowEnd.getTime()) break
      const d = new Date(runMs)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      scheduledByDate.set(key, (scheduledByDate.get(key) ?? 0) + 1)
    }
  }

  const days: CalendarDay[] = []

  // Leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, daysInPrevMonth - i)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    days.push({
      date,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
      meetings: meetingsByDate.get(key) ?? [],
      scheduledRuns: scheduledByDate.get(key) ?? 0,
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    days.push({
      date,
      isCurrentMonth: true,
      isToday: date.getTime() === today.getTime(),
      meetings: meetingsByDate.get(key) ?? [],
      scheduledRuns: scheduledByDate.get(key) ?? 0,
    })
  }

  // Trailing days from next month
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d)
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    days.push({
      date,
      isCurrentMonth: false,
      isToday: date.getTime() === today.getTime(),
      meetings: meetingsByDate.get(key) ?? [],
      scheduledRuns: scheduledByDate.get(key) ?? 0,
    })
  }

  return days
}

export function MeetingCalendar({
  meetings,
  schedules,
  onMeetingClick,
}: {
  meetings: Meeting[]
  schedules: MeetingSchedule[]
  onMeetingClick: (meetingId: string) => void
}) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const days = useMemo(
    () => getCalendarDays(viewYear, viewMonth, meetings, schedules),
    [viewYear, viewMonth, meetings, schedules],
  )

  return (
    <div className="bg-dracula-dark/60 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1 rounded hover:bg-dracula-dark/80 text-dracula-comment hover:text-dracula-light transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <h3 className="text-sm font-semibold text-dracula-light">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1 rounded hover:bg-dracula-dark/80 text-dracula-comment hover:text-dracula-light transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-[10px] font-bold uppercase tracking-widest text-dracula-comment py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-dracula-dark/30 rounded-lg overflow-hidden">
        {days.map((day, i) => (
          <DayCell
            key={i}
            day={day}
            onMeetingClick={onMeetingClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-dracula-comment">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-dracula-green" />
          Concluded
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-dracula-purple" />
          Active
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-dracula-comment/50 border border-dracula-comment/30" />
          Scheduled
        </span>
      </div>
    </div>
  )
}

function DayCell({
  day,
  onMeetingClick,
}: {
  day: CalendarDay
  onMeetingClick: (meetingId: string) => void
}) {
  const { date, isCurrentMonth, isToday, meetings, scheduledRuns } = day

  return (
    <div
      className={`min-h-[56px] p-1 bg-dracula-darker/60 transition-colors ${
        isCurrentMonth ? '' : 'opacity-30'
      }`}
    >
      {/* Date number */}
      <div className={`text-[11px] font-semibold w-5 h-5 flex items-center justify-center rounded-full mb-0.5 ${
        isToday
          ? 'bg-dracula-purple text-white'
          : 'text-dracula-comment'
      }`}>
        {date.getDate()}
      </div>

      {/* Dots for meetings */}
      <div className="flex flex-wrap gap-0.5">
        {meetings.map((m) => (
          <button
            key={m.id}
            onClick={() => onMeetingClick(m.id)}
            title={m.topic}
            className={`w-2 h-2 rounded-full transition-opacity hover:opacity-80 ${
              m.status === 'concluded'
                ? 'bg-dracula-green'
                : m.status === 'setup'
                ? 'bg-dracula-comment'
                : 'bg-dracula-purple'
            }`}
          />
        ))}
        {/* Ghost dots for scheduled future runs */}
        {Array.from({ length: scheduledRuns }).map((_, i) => (
          <span
            key={`sched-${i}`}
            className="w-2 h-2 rounded-full border border-dracula-comment/40 bg-transparent"
          />
        ))}
      </div>
    </div>
  )
}
