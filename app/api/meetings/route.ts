import { NextRequest, NextResponse } from 'next/server'
import { getAllProjects } from '@/lib/store'
import { dbGetAllMeetings } from '@/lib/db/repositories/meetingRepo'
import { dbGetMessagesByMeeting } from '@/lib/db/repositories/meetingRepo'
import type { MeetingHistoryEntry } from '@/lib/types'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const statusParam = searchParams.get('status') // 'all' | 'setup' | 'active' | 'concluded'

  const from = fromParam ? parseInt(fromParam, 10) : undefined
  const to   = toParam   ? parseInt(toParam,   10) : undefined

  // Build a project name map
  const projects = getAllProjects()
  const projectMap = new Map(projects.map((p) => [p.id, p.name]))

  let allMeetings = dbGetAllMeetings()

  // Date range filter
  if (from !== undefined && !Number.isNaN(from)) {
    allMeetings = allMeetings.filter((m) => m.createdAt >= from)
  }
  if (to !== undefined && !Number.isNaN(to)) {
    allMeetings = allMeetings.filter((m) => m.createdAt <= to)
  }

  // Status filter
  if (statusParam && statusParam !== 'all') {
    if (statusParam === 'active') {
      allMeetings = allMeetings.filter((m) => m.status !== 'setup' && m.status !== 'concluded')
    } else {
      allMeetings = allMeetings.filter((m) => m.status === statusParam)
    }
  }

  // Enrich with message aggregations
  const entries: MeetingHistoryEntry[] = allMeetings.map((m) => {
    const messages = dbGetMessagesByMeeting(m.id)
    const doneMessages = messages.filter((msg) => msg.status === 'done')
    const totalTokens = doneMessages.reduce(
      (s, msg) => s + (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0), 0
    )
    const totalCostUsd = doneMessages.reduce((s, msg) => s + (msg.costUsd ?? 0), 0)
    return {
      id: m.id,
      projectId: m.projectId,
      projectName: projectMap.get(m.projectId) ?? 'Unknown',
      topic: m.topic,
      status: m.status,
      agentCount: doneMessages.length,
      totalTokens,
      totalCostUsd,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }
  })

  return NextResponse.json(entries)
}
