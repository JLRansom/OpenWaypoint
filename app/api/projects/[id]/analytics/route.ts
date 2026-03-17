import { NextRequest, NextResponse } from 'next/server'
import { getProject, getTasksByProject } from '@/lib/store'
import { dbGetProjectAnalytics, dbGetMeetingAnalytics } from '@/lib/db/repositories/analyticsRepo'
import type { RecentTaskEntry, TaskStatusCount } from '@/lib/types'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const { searchParams } = req.nextUrl
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const fromParsed = fromParam ? parseInt(fromParam, 10) : undefined
  const toParsed   = toParam   ? parseInt(toParam,   10) : undefined
  // Guard against NaN (e.g. from='abc') — treat as "no filter"
  const from = fromParsed !== undefined && !Number.isNaN(fromParsed) ? fromParsed : undefined
  const to   = toParsed   !== undefined && !Number.isNaN(toParsed)   ? toParsed   : undefined

  const data = dbGetProjectAnalytics(id, from, to)
  const meetingStats = dbGetMeetingAnalytics(id, from, to)

  // Enrich with task-store data (status counts, recently updated, active count)
  const allTasks = getTasksByProject(id).filter((t) => !t.archived)

  const statusCountMap = new Map<string, number>()
  let activeTaskCount = 0
  for (const t of allTasks) {
    statusCountMap.set(t.status, (statusCountMap.get(t.status) ?? 0) + 1)
    if (t.status === 'in-progress' || t.status === 'review' || t.status === 'testing') {
      activeTaskCount++
    }
  }

  const taskStatusCounts: TaskStatusCount[] = Array.from(statusCountMap.entries()).map(
    ([status, count]) => ({ status, count }),
  )

  const recentlyUpdatedTasks: RecentTaskEntry[] = allTasks
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10)
    .map((t) => ({ id: t.id, title: t.title, status: t.status, updatedAt: t.updatedAt }))

  const totalRuns = data.summary.totalRunsDone + data.summary.totalRunsFailed
  const successRate = totalRuns > 0 ? (data.summary.totalRunsDone / totalRuns) * 100 : 0

  return NextResponse.json({
    ...data,
    summary: { ...data.summary, activeTaskCount, successRate },
    taskStatusCounts,
    recentlyUpdatedTasks,
    meetingStats,
  })
}
