import { NextRequest, NextResponse } from 'next/server'
import { getProject, getMeeting, updateMeeting, addMeetingMessage } from '@/lib/store'
import { MEETING_AGENT_ORDER } from '@/lib/types'
import { runMeeting } from '@/lib/services/agentService'

export async function POST(
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

  if (meeting.status !== 'setup') {
    return NextResponse.json({ error: 'meeting already started' }, { status: 409 })
  }

  // Pre-create message slots for each agent in speaking order
  for (const agentType of MEETING_AGENT_ORDER) {
    addMeetingMessage({
      meetingId,
      agentType,
      content: '',
      status: 'pending',
    })
  }

  updateMeeting(meetingId, { status: 'writer-speaking', updatedAt: Date.now() })

  // Fire and forget — orchestration runs async
  runMeeting(meetingId).catch((err) => {
    console.error('[meetings] runMeeting error:', err)
    updateMeeting(meetingId, { status: 'concluded', updatedAt: Date.now() })
  })

  return NextResponse.json({ status: 'started' })
}
