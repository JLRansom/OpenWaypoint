import { NextRequest, NextResponse } from 'next/server'
import { getProject, getSchedule, updateSchedule, deleteSchedule } from '@/lib/store'
import { validateCron, getNextCronRun } from '@/lib/cron-utils'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const { id, scheduleId } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const schedule = getSchedule(scheduleId)
  if (!schedule || schedule.projectId !== id) {
    return NextResponse.json({ error: 'schedule not found' }, { status: 404 })
  }

  return NextResponse.json(schedule)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const { id, scheduleId } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const schedule = getSchedule(scheduleId)
  if (!schedule || schedule.projectId !== id) {
    return NextResponse.json({ error: 'schedule not found' }, { status: 404 })
  }

  const body = await req.json() as { cronExpression?: string; enabled?: boolean }
  const patch: Partial<typeof schedule> = {}

  if (typeof body.enabled === 'boolean') {
    patch.enabled = body.enabled
  }

  if (typeof body.cronExpression === 'string') {
    const validationError = validateCron(body.cronExpression)
    if (validationError) {
      return NextResponse.json({ error: `Invalid cron expression: ${validationError}` }, { status: 400 })
    }
    patch.cronExpression = body.cronExpression
    const nextRunAt = getNextCronRun(body.cronExpression, Date.now())
    if (nextRunAt) patch.nextRunAt = nextRunAt
  }

  updateSchedule(scheduleId, patch)
  return NextResponse.json({ ...schedule, ...patch, updatedAt: Date.now() })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> },
) {
  const { id, scheduleId } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const schedule = getSchedule(scheduleId)
  if (!schedule || schedule.projectId !== id) {
    return NextResponse.json({ error: 'schedule not found' }, { status: 404 })
  }

  deleteSchedule(scheduleId)
  return NextResponse.json({ deleted: true })
}
