import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { taskFiles } from '@/lib/db/schema'
import { TaskFile } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type TaskFileRow = typeof taskFiles.$inferSelect

function rowToTaskFile(row: TaskFileRow): TaskFile {
  return {
    id:          row.id,
    taskId:      row.taskId,
    filename:    row.filename,
    mimeType:    row.mimeType,
    sizeBytes:   row.sizeBytes,
    storagePath: row.storagePath,
    createdAt:   row.createdAt,
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Return all files attached to a task, ordered oldest-first. */
export function dbGetFilesByTask(taskId: string): TaskFile[] {
  const rows = db
    .select()
    .from(taskFiles)
    .where(eq(taskFiles.taskId, taskId))
    .all()
  return rows.map(rowToTaskFile)
}

/** Return a single file record by its ID, or undefined if not found. */
export function dbGetTaskFile(id: string): TaskFile | undefined {
  const row = db
    .select()
    .from(taskFiles)
    .where(eq(taskFiles.id, id))
    .get()
  return row ? rowToTaskFile(row) : undefined
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Insert a new file record. */
export function dbAddTaskFile(file: TaskFile): void {
  db.insert(taskFiles).values({
    id:          file.id,
    taskId:      file.taskId,
    filename:    file.filename,
    mimeType:    file.mimeType,
    sizeBytes:   file.sizeBytes,
    storagePath: file.storagePath,
    createdAt:   file.createdAt,
  }).run()
}

/**
 * Delete a file record by ID and return the deleted record (so the caller
 * can also remove the file from disk).  Returns undefined if not found.
 */
export function dbDeleteTaskFile(id: string): TaskFile | undefined {
  const existing = dbGetTaskFile(id)
  if (!existing) return undefined
  db.delete(taskFiles).where(eq(taskFiles.id, id)).run()
  return existing
}

/** Delete ALL file records for a task (used when the task itself is deleted). */
export function dbDeleteTaskFilesByTask(taskId: string): TaskFile[] {
  const existing = dbGetFilesByTask(taskId)
  db.delete(taskFiles).where(eq(taskFiles.taskId, taskId)).run()
  return existing
}
