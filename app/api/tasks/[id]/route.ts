import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getTask, updateTask, deleteTask, deleteTaskFilesByTask } from '@/lib/store'
import { uploadsRoot } from '@/lib/file-utils'
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

  // Clean up file attachments from disk before removing the task row.
  // deleteTaskFilesByTask() removes DB rows (ON DELETE CASCADE would also handle
  // this, but we need the storagePaths before they're gone).
  const deletedFiles = deleteTaskFilesByTask(id)
  const root = uploadsRoot()
  for (const file of deletedFiles) {
    const diskPath = path.join(process.cwd(), file.storagePath)
    // Path traversal guard — only delete files that live inside the uploads root
    if (!diskPath.startsWith(root + path.sep)) continue
    try {
      fs.unlinkSync(diskPath)
    } catch {
      // Ignore — file may already be gone
    }
  }
  // Remove the now-empty per-task upload directory (best-effort)
  const uploadDir = path.join(process.cwd(), 'data', 'uploads', id)
  try {
    fs.rmdirSync(uploadDir)
  } catch {
    // Ignore — directory may not be empty or may not exist
  }

  deleteTask(id)
  return new NextResponse(null, { status: 204 })
}
