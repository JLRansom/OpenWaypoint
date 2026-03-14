import { NextRequest, NextResponse } from 'next/server'
import { getProject, getMeeting, getMessagesByMeeting } from '@/lib/store'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> },
) {
  const { id, meetingId } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const meeting = getMeeting(meetingId)
  if (!meeting || meeting.projectId !== id) {
    return NextResponse.json({ error: 'meeting not found' }, { status: 404 })
  }

  const messages = getMessagesByMeeting(meetingId)

  // Aggregate cost/token totals from message stats
  const totalCostUsd = messages.reduce((sum, m) => sum + (m.costUsd ?? 0), 0)
  const totalTokens = messages.reduce(
    (sum, m) => sum + (m.inputTokens ?? 0) + (m.outputTokens ?? 0),
    0,
  )

  return NextResponse.json({ meeting, messages, totalCostUsd, totalTokens })
}
