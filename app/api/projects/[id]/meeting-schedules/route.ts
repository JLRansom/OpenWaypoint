import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getProject, getSchedulesByProject, addSchedule } from '@/lib/store'
import { validateCron, getNextCronRun } from '@/lib/cron-utils'
import type { MeetingSchedule } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })
  return NextResponse.json(getSchedulesByProject(id))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const body = await req.json() as { cronExpression?: string }
  const { cronExpression } = body

  if (!cronExpression || typeof cronExpression !== 'string') {
    return NextResponse.json({ error: 'cronExpression is required' }, { status: 400 })
  }

  const validationError = validateCron(cronExpression)
  if (validationError) {
    return NextResponse.json({ error: `Invalid cron expression: ${validationError}` }, { status: 400 })
  }

  const nextRunAt = getNextCronRun(cronExpression, Date.now())
  if (!nextRunAt) {
    return NextResponse.json({ error: 'Cron expression produces no future runs' }, { status: 400 })
  }

  const now = Date.now()
  const schedule: MeetingSchedule = {
    id:             randomUUID(),
    projectId:      id,
    cronExpression,
    nextRunAt,
    enabled:        true,
    createdAt:      now,
    updatedAt:      now,
  }

  addSchedule(schedule)
  return NextResponse.json(schedule, { status: 201 })
}
