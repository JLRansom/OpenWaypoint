import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getProject, getTagsByProject, addTag } from '@/lib/store'
import type { ProjectTag } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(getTagsByProject(id))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  let body: { name?: string; color?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const color = typeof body.color === 'string' && body.color.trim()
    ? body.color.trim()
    : '#6272a4'

  const tag: ProjectTag = {
    id: randomUUID(),
    projectId: id,
    name,
    color,
    createdAt: Date.now(),
  }
  addTag(tag)
  return NextResponse.json(tag, { status: 201 })
}
