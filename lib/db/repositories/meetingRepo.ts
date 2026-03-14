import { eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { meetings, meetingMessages } from '@/lib/db/schema'
import type { Meeting, MeetingMessage, MeetingStatus, MeetingMessageStatus, MeetingAgentType } from '@/lib/types'

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

type MeetingRow = typeof meetings.$inferSelect
type MeetingMessageRow = typeof meetingMessages.$inferSelect

function rowToMeeting(row: MeetingRow): Meeting {
  return {
    id:        row.id,
    projectId: row.projectId,
    topic:     row.topic,
    status:    row.status as MeetingStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function rowToMessage(row: MeetingMessageRow): MeetingMessage {
  return {
    id:           row.id,
    meetingId:    row.meetingId,
    agentType:    row.agentType as MeetingAgentType,
    content:      row.content,
    status:       row.status as MeetingMessageStatus,
    startedAt:    row.startedAt ?? undefined,
    completedAt:  row.completedAt ?? undefined,
    inputTokens:  row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    costUsd:      row.costUsd ?? undefined,
    model:        row.model ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all meetings for a project, newest first. */
export function dbGetMeetingsByProject(projectId: string): Meeting[] {
  return db
    .select()
    .from(meetings)
    .where(eq(meetings.projectId, projectId))
    .all()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(rowToMeeting)
}

/** Return all meetings that are NOT concluded — for SSE broadcast. */
export function dbGetAllActiveMeetings(): Meeting[] {
  return db
    .select()
    .from(meetings)
    .where(ne(meetings.status, 'concluded'))
    .all()
    .map(rowToMeeting)
}

/** Return a single meeting by ID. */
export function dbGetMeeting(id: string): Meeting | undefined {
  const row = db.select().from(meetings).where(eq(meetings.id, id)).get()
  return row ? rowToMeeting(row) : undefined
}

/** Return all messages for a meeting, in insertion order. */
export function dbGetMessagesByMeeting(meetingId: string): MeetingMessage[] {
  return db
    .select()
    .from(meetingMessages)
    .where(eq(meetingMessages.meetingId, meetingId))
    .all()
    .map(rowToMessage)
}

/** Return all messages for active (non-concluded) meetings — for SSE broadcast. */
export function dbGetAllActiveMeetingMessages(): MeetingMessage[] {
  const activeMeetingIds = dbGetAllActiveMeetings().map((m) => m.id)
  if (activeMeetingIds.length === 0) return []
  // Small set — filter in JS rather than building a dynamic IN clause
  return db
    .select()
    .from(meetingMessages)
    .all()
    .filter((row) => activeMeetingIds.includes(row.meetingId))
    .map(rowToMessage)
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Insert a new meeting. */
export function dbAddMeeting(meeting: Meeting): void {
  db.insert(meetings)
    .values({
      id:        meeting.id,
      projectId: meeting.projectId,
      topic:     meeting.topic,
      status:    meeting.status,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
    })
    .run()
}

/** Partial update of a meeting row. */
export function dbUpdateMeeting(id: string, patch: Partial<Meeting>): void {
  db.update(meetings)
    .set(patch)
    .where(eq(meetings.id, id))
    .run()
}

/** Insert a new meeting message and return its auto-incremented ID. */
export function dbAddMeetingMessage(
  msg: Omit<MeetingMessage, 'id'>,
): number {
  const result = db
    .insert(meetingMessages)
    .values({
      meetingId:   msg.meetingId,
      agentType:   msg.agentType,
      content:     msg.content,
      status:      msg.status,
      startedAt:   msg.startedAt ?? null,
      completedAt: msg.completedAt ?? null,
    })
    .run()
  return Number(result.lastInsertRowid)
}

/** Partial update of a meeting message row. */
export function dbUpdateMeetingMessage(
  id: number,
  patch: Partial<Omit<MeetingMessage, 'id' | 'meetingId' | 'agentType'>>,
): void {
  db.update(meetingMessages)
    .set(patch)
    .where(eq(meetingMessages.id, id))
    .run()
}
