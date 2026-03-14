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

  // topic is optional — if omitted, the writer agent generates it autonomously
  let body: { topic?: string } = {}
  try { body = await req.json() } catch { /* empty body is fine */ }
  const topic = typeof body.topic === 'string' && body.topic.trim()
    ? body.topic.trim()
    : 'Generating topic...'

  const meeting: Meeting = {
    id: randomUUID(),
    projectId: id,
    topic,
    status: 'setup',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  addMeeting(meeting)
  return NextResponse.json(meeting, { status: 201 })
}
