import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getProject, getMeetingsByProject, addMeeting } from '@/lib/store'
import type { Meeting } from '@/lib/types'

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

  const body = await req.json()
  const { topic } = body as { topic?: string }

  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const meeting: Meeting = {
    id: randomUUID(),
    projectId: id,
    topic: topic.trim(),
    status: 'setup',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  addMeeting(meeting)
  return NextResponse.json(meeting, { status: 201 })
}
