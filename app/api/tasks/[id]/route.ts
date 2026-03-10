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
  const { title, description, status, archived } = body as {
    title?: string
    description?: string
    status?: TaskStatus
    archived?: boolean
  }

  updateTask(id, {
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(status !== undefined && { status }),
    ...(archived !== undefined && { archived }),
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
