import { and, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { tasks } from '../schema'
import { Task } from '@/lib/types'

export interface TaskQueryOptions {
  archived?: boolean
  /** Filter to tasks that have ALL of these tags. */
  tags?: string[]
}

type TaskRow = typeof tasks.$inferSelect

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status as Task['status'],
    activeAgentId: row.activeAgentId ?? undefined,
    researcherOutput: row.researcherOutput ?? undefined,
    coderOutput: row.coderOutput ?? undefined,
    reviewNotes: row.reviewNotes ?? undefined,
    testerOutput: row.testerOutput ?? undefined,
    archived: row.archived ?? false,
    tags: parseTags(row.tags),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function dbGetAllTasks(): Task[] {
  return db
    .select()
    .from(tasks)
    .orderBy(tasks.createdAt)
    .all()
    .map(rowToTask)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function dbGetTask(id: string): Task | undefined {
  const row = db.select().from(tasks).where(eq(tasks.id, id)).get()
  return row ? rowToTask(row) : undefined
}

export function dbGetTasksByProject(projectId: string, opts?: TaskQueryOptions): Task[] {
  const conditions = [eq(tasks.projectId, projectId)]

  if (opts?.archived !== undefined) {
    conditions.push(eq(tasks.archived, opts.archived))
  }

  // For each required tag, add a LIKE clause that matches the JSON-encoded value.
  // Wrapping in quotes prevents "bug" from matching "debug".
  if (opts?.tags?.length) {
    for (const tag of opts.tags) {
      const pattern = `%"${tag}"%`
      conditions.push(sql`${tasks.tags} LIKE ${pattern}`)
    }
  }

  const where = conditions.length === 1 ? conditions[0] : and(...conditions)

  return db
    .select()
    .from(tasks)
    .where(where)
    .all()
    .map(rowToTask)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function dbAddTask(task: Task): void {
  db.insert(tasks).values({
    id: task.id,
    projectId: task.projectId,
    title: task.title,
    description: task.description,
    status: task.status,
    activeAgentId: task.activeAgentId ?? null,
    researcherOutput: task.researcherOutput ?? null,
    coderOutput: task.coderOutput ?? null,
    reviewNotes: task.reviewNotes ?? null,
    testerOutput: task.testerOutput ?? null,
    archived: task.archived ?? false,
    tags: JSON.stringify(task.tags ?? []),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }).run()
}

export function dbUpdateTask(id: string, patch: Partial<Task>): void {
  const update: Partial<typeof tasks.$inferInsert> = {
    updatedAt: Date.now(),
  }

  if (patch.title !== undefined) update.title = patch.title
  if (patch.description !== undefined) update.description = patch.description
  if (patch.status !== undefined) update.status = patch.status
  if ('activeAgentId' in patch) update.activeAgentId = patch.activeAgentId ?? null
  if ('researcherOutput' in patch) update.researcherOutput = patch.researcherOutput ?? null
  if ('coderOutput' in patch) update.coderOutput = patch.coderOutput ?? null
  if ('reviewNotes' in patch) update.reviewNotes = patch.reviewNotes ?? null
  if ('testerOutput' in patch) update.testerOutput = patch.testerOutput ?? null
  if (patch.archived !== undefined) update.archived = patch.archived
  if (patch.tags !== undefined) update.tags = JSON.stringify(patch.tags)
  if (patch.updatedAt !== undefined) update.updatedAt = patch.updatedAt

  db.update(tasks).set(update).where(eq(tasks.id, id)).run()
}

export function dbDeleteTask(id: string): void {
  db.delete(tasks).where(eq(tasks.id, id)).run()
}
