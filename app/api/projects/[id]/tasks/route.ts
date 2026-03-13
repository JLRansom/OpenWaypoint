import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Task, TaskStatus } from '@/lib/types'
import { getProject, getTasksByProject, addTask } from '@/lib/store'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const archivedParam = req.nextUrl.searchParams.get('archived')
  let archivedFilter: boolean | undefined
  if (archivedParam === 'true') archivedFilter = true
  else if (archivedParam === 'false') archivedFilter = false
  // 'all' or absent → undefined (no filter, return everything)

  return NextResponse.json(getTasksByProject(id, { archived: archivedFilter }))
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const project = getProject(id)
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const { title, description, status } = body as { title: string; description?: string; status?: TaskStatus }

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 })
  }

  const task: Task = {
    id: randomUUID(),
    projectId: id,
    title,
    description: description ?? '',
    status: status ?? 'backlog',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  addTask(task)

  return NextResponse.json(task, { status: 201 })
}
