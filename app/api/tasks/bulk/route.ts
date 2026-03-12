import { NextRequest, NextResponse } from 'next/server'
import { dbUpdateTask, dbDeleteTask } from '@/lib/db/repositories/taskRepo'
import { broadcast } from '@/lib/broadcast'
import { getStreamPayload } from '@/lib/store'
import { deleteTaskWithFiles } from '@/lib/file-utils'
import { TaskStatus } from '@/lib/types'

const MAX_BULK_IDS = 500

type BulkBody =
  | { action: 'archive'; taskIds: string[] }
  | { action: 'move';    taskIds: string[]; status: TaskStatus }
  | { action: 'delete';  taskIds: string[] }

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BulkBody

  if (!body.action || !Array.isArray(body.taskIds) || body.taskIds.length === 0) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (body.taskIds.length > MAX_BULK_IDS) {
    return NextResponse.json(
      { error: `bulk operations are limited to ${MAX_BULK_IDS} items` },
      { status: 400 }
    )
  }

  if (body.action === 'archive') {
    for (const id of body.taskIds) {
      dbUpdateTask(id, { archived: true })
    }
  } else if (body.action === 'move') {
    if (!body.status) return NextResponse.json({ error: 'status required' }, { status: 400 })
    for (const id of body.taskIds) {
      dbUpdateTask(id, { status: body.status })
    }
  } else if (body.action === 'delete') {
    for (const id of body.taskIds) {
      await deleteTaskWithFiles(id)
      dbDeleteTask(id)
    }
  } else {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }

  broadcast(getStreamPayload())
  return NextResponse.json({ ok: true, count: body.taskIds.length })
}
