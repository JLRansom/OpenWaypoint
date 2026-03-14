import { eq, and, lte } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meetingSchedules } from '@/lib/db/schema'
import type { MeetingSchedule } from '@/lib/types'

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

type ScheduleRow = typeof meetingSchedules.$inferSelect

function rowToSchedule(row: ScheduleRow): MeetingSchedule {
  return {
    id:             row.id,
    projectId:      row.projectId,
    cronExpression: row.cronExpression,
    nextRunAt:      row.nextRunAt,
    enabled:        row.enabled,
    createdAt:      row.createdAt,
    updatedAt:      row.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all schedules for a project, newest first. */
export function dbGetSchedulesByProject(projectId: string): MeetingSchedule[] {
  return db
    .select()
    .from(meetingSchedules)
    .where(eq(meetingSchedules.projectId, projectId))
    .all()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(rowToSchedule)
}

/** Return all enabled schedules (for SSE broadcast). */
export function dbGetAllEnabledSchedules(): MeetingSchedule[] {
  return db
    .select()
    .from(meetingSchedules)
    .where(eq(meetingSchedules.enabled, true))
    .all()
    .map(rowToSchedule)
}

/** Return enabled schedules whose nextRunAt is <= now. */
export function dbGetDueSchedules(now: number): MeetingSchedule[] {
  return db
    .select()
    .from(meetingSchedules)
    .where(
      and(
        eq(meetingSchedules.enabled, true),
        lte(meetingSchedules.nextRunAt, now),
      ),
    )
    .all()
    .map(rowToSchedule)
}

/** Return a single schedule by ID. */
export function dbGetSchedule(id: string): MeetingSchedule | undefined {
  const row = db.select().from(meetingSchedules).where(eq(meetingSchedules.id, id)).get()
  return row ? rowToSchedule(row) : undefined
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Insert a new meeting schedule. */
export function dbAddSchedule(schedule: MeetingSchedule): void {
  db.insert(meetingSchedules)
    .values({
      id:             schedule.id,
      projectId:      schedule.projectId,
      cronExpression: schedule.cronExpression,
      nextRunAt:      schedule.nextRunAt,
      enabled:        schedule.enabled,
      createdAt:      schedule.createdAt,
      updatedAt:      schedule.updatedAt,
    })
    .run()
}

/** Partial update of a schedule row. */
export function dbUpdateSchedule(id: string, patch: Partial<MeetingSchedule>): void {
  db.update(meetingSchedules)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(meetingSchedules.id, id))
    .run()
}

/** Delete a schedule by ID. */
export function dbDeleteSchedule(id: string): void {
  db.delete(meetingSchedules)
    .where(eq(meetingSchedules.id, id))
    .run()
}
