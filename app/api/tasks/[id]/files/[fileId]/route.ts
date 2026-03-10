import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getTask, deleteTaskFile, updateTask } from '@/lib/store'

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

  const deleted = deleteTaskFile(fileId)
  if (!deleted) return NextResponse.json({ error: 'file not found' }, { status: 404 })

  // Remove bytes from disk (best-effort — don't fail the request if the file
  // is already gone)
  const diskPath = path.join(process.cwd(), deleted.storagePath)
  try {
    fs.unlinkSync(diskPath)
  } catch {
    // Ignore — file may have been manually deleted
  }

  // Bump task updatedAt to trigger SSE broadcast
  updateTask(id, {})

  return new NextResponse(null, { status: 204 })
}
