/**
 * Meeting scheduler singleton.
 * Runs a periodic check for due meeting schedules and auto-creates + starts meetings.
 * Uses a globalThis guard so it survives Next.js hot module reloads without
 * creating duplicate intervals.
 */

import { randomUUID } from 'crypto'

const SCHEDULER_INTERVAL_MS = 30_000 // check every 30 seconds
const GLOBAL_KEY = '__meetingSchedulerStarted__'

declare global {
  // eslint-disable-next-line no-var
  var __meetingSchedulerStarted__: boolean | undefined
}

export function startMeetingScheduler(): void {
  if (globalThis[GLOBAL_KEY]) return
  globalThis[GLOBAL_KEY] = true

  setInterval(checkDueSchedules, SCHEDULER_INTERVAL_MS)
  console.log('[meeting-scheduler] started (interval: 30s)')
}

async function checkDueSchedules(): Promise<void> {
  // Lazy imports to avoid circular dependencies at module init time
  const { dbGetDueSchedules, dbUpdateSchedule } = await import(
    '@/lib/db/repositories/meetingScheduleRepo'
  )
  const { dbAddMeeting, dbAddMeetingMessage, dbUpdateMeeting } = await import(
    '@/lib/db/repositories/meetingRepo'
  )
  const { runMeeting } = await import('@/lib/services/agentService')
  const { broadcast, getStreamPayload } = await import('@/lib/store')
  const { getNextCronRun } = await import('@/lib/cron-utils')
  const { MEETING_AGENT_ORDER } = await import('@/lib/types')

  const now = Date.now()
  const dueSchedules = dbGetDueSchedules(now)
  if (dueSchedules.length === 0) return

  for (const schedule of dueSchedules) {
    try {
      // Create meeting with placeholder topic
      const meetingId = randomUUID()
      dbAddMeeting({
        id:        meetingId,
        projectId: schedule.projectId,
        topic:     'Generating topic...',
        status:    'setup',
        createdAt: now,
        updatedAt: now,
      })

      // Pre-create message slots
      for (const agentType of MEETING_AGENT_ORDER) {
        dbAddMeetingMessage({
          meetingId,
          agentType,
          content:  '',
          status:   'pending',
        })
      }

      // Update meeting to writer-speaking and kick off orchestration
      dbUpdateMeeting(meetingId, { status: 'writer-speaking', updatedAt: now })

      runMeeting(meetingId).catch((err) => {
        console.error('[meeting-scheduler] runMeeting error:', err)
        dbUpdateMeeting(meetingId, { status: 'concluded', updatedAt: Date.now() })
      })

      // Advance schedule to the next run
      const nextRunAt = getNextCronRun(schedule.cronExpression, now + 60_000)
      if (nextRunAt) {
        dbUpdateSchedule(schedule.id, { nextRunAt })
      } else {
        // Disable schedule if no next run exists (e.g. expression expired)
        dbUpdateSchedule(schedule.id, { enabled: false })
      }

      // Broadcast updated state
      const storeModule = await import('@/lib/store')
      storeModule.broadcast(storeModule.getStreamPayload())
    } catch (err) {
      console.error('[meeting-scheduler] error processing schedule', schedule.id, err)
    }
  }
}
