import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getProject, getMeetingsByProject, addMeeting, getTask } from '@/lib/store'
import type { Meeting, MeetingType } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(getMeetingsByProject(id))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // topic and meetingType are optional
  let body: { topic?: string; meetingType?: string; taskId?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }

  const meetingType: MeetingType =
    body.meetingType === 'card-discussion' ? 'card-discussion' : 'ideas'

  // For card-discussion, derive default topic from the task title
  let topic = 'Generating topic...'
  if (typeof body.topic === 'string' && body.topic.trim()) {
    topic = body.topic.trim()
  } else if (meetingType === 'card-discussion' && body.taskId) {
    const task = getTask(body.taskId)
    topic = task ? `Card Discussion: ${task.title}` : 'Card Discussion'
  }

  // Validate taskId for card-discussion meetings
  if (meetingType === 'card-discussion' && body.taskId) {
    const task = getTask(body.taskId)
    if (!task || task.projectId !== id) {
      return NextResponse.json({ error: 'task not found in this project' }, { status: 400 })
    }
  }

  const meeting: Meeting = {
    id: randomUUID(),
    projectId: id,
    topic,
    status: 'setup',
    meetingType,
    taskId: meetingType === 'card-discussion' ? (body.taskId ?? undefined) : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  addMeeting(meeting)
  return NextResponse.json(meeting, { status: 201 })
}
