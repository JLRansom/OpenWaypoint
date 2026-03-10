import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getTask, getTaskFile, deleteTaskFile, updateTask } from '@/lib/store'

// ---------------------------------------------------------------------------
// DELETE /api/tasks/[id]/files/[fileId] — remove a single file attachment
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params

  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 })

  // Verify ownership BEFORE deleting from DB
  const file = getTaskFile(fileId)
  if (!file) return NextResponse.json({ error: 'file not found' }, { status: 404 })
  if (file.taskId !== id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  deleteTaskFile(fileId)

  // Remove bytes from disk (best-effort — don't fail the request if the file
  // is already gone)
  const diskPath = path.join(process.cwd(), file.storagePath)

  const root = path.join(process.cwd(), 'data', 'uploads')
  if (!diskPath.startsWith(root + path.sep) && diskPath !== root) {
    // Best-effort skip disk delete but don't fail
    updateTask(id, {})
    return new NextResponse(null, { status: 204 })
  }

  try {
    fs.unlinkSync(diskPath)
  } catch {
    // Ignore — file may have been manually deleted
  }

  // Bump task updatedAt to trigger SSE broadcast
  updateTask(id, {})

  return new NextResponse(null, { status: 204 })
}
