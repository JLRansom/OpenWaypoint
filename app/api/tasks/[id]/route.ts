import { NextRequest, NextResponse } from 'next/server'
import { getTask, updateTask, deleteTask } from '@/lib/store'
import { deleteTaskWithFiles } from '@/lib/file-utils'
import { TaskStatus } from '@/lib/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(task)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const body = await req.json()
  const { title, description, status, archived, tags } = body as {
    title?: string
    description?: string
    status?: TaskStatus
    archived?: boolean
    tags?: string[]
  }

  // Sanitise tags: unique lowercase strings, max 32 chars each, max 20 tags total
  const sanitisedTags = tags !== undefined
    ? [...new Set(
        tags
          .map((t) => String(t).toLowerCase().trim().slice(0, 32))
          .filter(Boolean)
      )].slice(0, 20)
    : undefined

  updateTask(id, {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
    ...(archived !== undefined && { archived }),
    ...(sanitisedTags !== undefined && { tags: sanitisedTags }),
  })

  return NextResponse.json(getTask(id))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'not found' }, { status: 404 })

  await deleteTaskWithFiles(id)
  deleteTask(id)
  return new NextResponse(null, { status: 204 })
}
