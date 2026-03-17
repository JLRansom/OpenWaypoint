import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../client'
import { taskRuns, meetings, meetingMessages } from '../schema'
import type {
  ProjectAnalyticsResponse,
  ProjectAnalyticsSummary,
  WeeklyTaskData,
  DailyTokenData,
  DailyCostData,
  RoleCostData,
  RecentRunEntry,
  MeetingAnalytics,
  MeetingsByDayData,
} from '@/lib/types'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns epoch ms for 00:00:00 UTC on the Monday of the week containing `epochMs`. */
export function getMondayEpoch(epochMs: number): number {
  const d = new Date(epochMs)
  const day = d.getUTCDay() // 0 = Sun, 1 = Mon, …
  const diff = day === 0 ? -6 : 1 - day // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

function getMondayKey(epochMs: number): string {
  return new Date(getMondayEpoch(epochMs)).toISOString().slice(0, 10) // "YYYY-MM-DD"
}

function getDayKey(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 10) // "YYYY-MM-DD"
}

function shortDateLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Returns aggregated analytics for a single project.
 * Fetches all matching task runs in one query and aggregates in JS.
 */
export function dbGetProjectAnalytics(
  projectId: string,
  from?: number,
  to?: number,
): ProjectAnalyticsResponse {
  const conditions: (SQL | undefined)[] = [eq(taskRuns.projectId, projectId)]
  if (from !== undefined) conditions.push(gte(taskRuns.completedAt, from))
  if (to !== undefined) conditions.push(lte(taskRuns.completedAt, to))

  const rows = db
    .select()
    .from(taskRuns)
    .where(and(...conditions))
    .all()

  // --- Summary ---
  let totalRunsDone = 0
  let totalRunsFailed = 0
  let totalCostUsd = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalDurationMs = 0

  for (const r of rows) {
    if (r.status === 'done') totalRunsDone++
    else totalRunsFailed++
    totalCostUsd += r.costUsd ?? 0
    totalInputTokens += r.inputTokens ?? 0
    totalOutputTokens += r.outputTokens ?? 0
    totalDurationMs += r.completedAt - r.startedAt
  }

  const totalRuns = totalRunsDone + totalRunsFailed
  // summary.activeTaskCount and successRate are injected by the route handler
  // (which has access to the task store); provide defaults here.
  const summary: ProjectAnalyticsSummary = {
    totalRunsDone,
    totalRunsFailed,
    totalCostUsd,
    totalInputTokens,
    totalOutputTokens,
    avgCostPerRun: totalRunsDone > 0 ? totalCostUsd / totalRunsDone : 0,
    avgDurationMs: totalRuns > 0 ? totalDurationMs / totalRuns : 0,
    activeTaskCount: 0,
    successRate: totalRuns > 0 ? (totalRunsDone / totalRuns) * 100 : 0,
  }

  // --- Weekly tasks ---
  // Key: "YYYY-MM-DD" of the Monday of that week. Value: { weekLabel, done, failed }
  const weekMap = new Map<string, { weekLabel: string; done: number; failed: number }>()
  for (const r of rows) {
    const key = getMondayKey(r.completedAt)
    if (!weekMap.has(key)) {
      weekMap.set(key, { weekLabel: shortDateLabel(getMondayEpoch(r.completedAt)), done: 0, failed: 0 })
    }
    const bucket = weekMap.get(key)!
    if (r.status === 'done') bucket.done++
    else bucket.failed++
  }
  const weeklyTasks: WeeklyTaskData[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ weekLabel: v.weekLabel, done: v.done, failed: v.failed }))

  // --- Daily tokens ---
  const dayTokenMap = new Map<string, { dateLabel: string; inputTokens: number; outputTokens: number }>()
  for (const r of rows) {
    const key = getDayKey(r.completedAt)
    if (!dayTokenMap.has(key)) {
      dayTokenMap.set(key, { dateLabel: shortDateLabel(r.completedAt), inputTokens: 0, outputTokens: 0 })
    }
    const bucket = dayTokenMap.get(key)!
    bucket.inputTokens += r.inputTokens ?? 0
    bucket.outputTokens += r.outputTokens ?? 0
  }
  const dailyTokens: DailyTokenData[] = Array.from(dayTokenMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ dateLabel: v.dateLabel, inputTokens: v.inputTokens, outputTokens: v.outputTokens }))

  // --- Daily cost (cumulative) ---
  const dayCostMap = new Map<string, { dateLabel: string; cost: number }>()
  for (const r of rows) {
    const key = getDayKey(r.completedAt)
    if (!dayCostMap.has(key)) {
      dayCostMap.set(key, { dateLabel: shortDateLabel(r.completedAt), cost: 0 })
    }
    dayCostMap.get(key)!.cost += r.costUsd ?? 0
  }
  let running = 0
  const dailyCost: DailyCostData[] = Array.from(dayCostMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => {
      running += v.cost
      return { dateLabel: v.dateLabel, cumulativeCost: running }
    })

  // --- Cost by role ---
  const roleMap = new Map<string, number>()
  for (const r of rows) {
    roleMap.set(r.role, (roleMap.get(r.role) ?? 0) + (r.costUsd ?? 0))
  }
  const costByRole: RoleCostData[] = Array.from(roleMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([role, totalCost]) => ({ role, totalCost }))

  // --- Recent runs (last 15, sorted newest first) ---
  const recentRuns: RecentRunEntry[] = rows
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 15)
    .map((r) => ({
      id: r.id,
      taskTitle: r.taskTitle,
      role: r.role,
      status: r.status as 'done' | 'failed',
      costUsd: r.costUsd ?? undefined,
      durationMs: r.completedAt - r.startedAt,
      completedAt: r.completedAt,
      model: r.model ?? undefined,
    }))

  return {
    summary,
    weeklyTasks,
    dailyTokens,
    dailyCost,
    costByRole,
    recentRuns,
    // recentlyUpdatedTasks and taskStatusCounts are injected by the route handler
    recentlyUpdatedTasks: [],
    taskStatusCounts: [],
  }
}

/**
 * Returns meeting statistics for a project in a given time range.
 * Queries concluded meetings and aggregates their message costs/tokens.
 */
export function dbGetMeetingAnalytics(
  projectId: string,
  from?: number,
  to?: number,
): MeetingAnalytics {
  // Fetch concluded meetings for the project within the time range
  const meetingConditions: (SQL | undefined)[] = [
    eq(meetings.projectId, projectId),
    eq(meetings.status, 'concluded'),
  ]
  if (from !== undefined) meetingConditions.push(gte(meetings.createdAt, from))
  if (to !== undefined) meetingConditions.push(lte(meetings.createdAt, to))

  const meetingRows = db
    .select()
    .from(meetings)
    .where(and(...meetingConditions))
    .all()

  if (meetingRows.length === 0) {
    return { totalMeetings: 0, totalMeetingCostUsd: 0, totalMeetingTokens: 0, meetingsByDay: [] }
  }

  const meetingIds = meetingRows.map((m) => m.id)

  // Fetch all messages for these meetings
  const msgRows = db
    .select()
    .from(meetingMessages)
    .where(inArray(meetingMessages.meetingId, meetingIds))
    .all()

  // Build a map: meetingId → { costUsd, tokens }
  const msgMap = new Map<string, { costUsd: number; tokens: number }>()
  for (const msg of msgRows) {
    if (!msgMap.has(msg.meetingId)) msgMap.set(msg.meetingId, { costUsd: 0, tokens: 0 })
    const agg = msgMap.get(msg.meetingId)!
    agg.costUsd += msg.costUsd ?? 0
    agg.tokens  += (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)
  }

  let totalMeetingCostUsd = 0
  let totalMeetingTokens = 0

  // Build daily aggregation map
  const dayMap = new Map<string, { dateLabel: string; count: number; costUsd: number }>()
  for (const m of meetingRows) {
    const dayKey = getDayKey(m.createdAt)
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { dateLabel: shortDateLabel(m.createdAt), count: 0, costUsd: 0 })
    }
    const bucket = dayMap.get(dayKey)!
    bucket.count++
    const msgAgg = msgMap.get(m.id) ?? { costUsd: 0, tokens: 0 }
    bucket.costUsd += msgAgg.costUsd
    totalMeetingCostUsd += msgAgg.costUsd
    totalMeetingTokens  += msgAgg.tokens
  }

  const meetingsByDay: MeetingsByDayData[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({ dateLabel: v.dateLabel, count: v.count, costUsd: v.costUsd }))

  return {
    totalMeetings: meetingRows.length,
    totalMeetingCostUsd,
    totalMeetingTokens,
    meetingsByDay,
  }
}
