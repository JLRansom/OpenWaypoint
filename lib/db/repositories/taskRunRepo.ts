import { eq, desc, and, or, gte, lte, count, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../client'
import { taskRuns } from '../schema'
import { TaskRun } from '@/lib/types'

type TaskRunRow = typeof taskRuns.$inferSelect

function rowToTaskRun(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    taskId: row.taskId,
    taskTitle: row.taskTitle,
    projectId: row.projectId,
    projectName: row.projectName,
    agentId: row.agentId,
    role: row.role,
    status: row.status as TaskRun['status'],
    output: row.output,
    error: row.error ?? undefined,
    rawLog: row.rawLog ?? undefined,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    inputTokens: row.inputTokens ?? undefined,
    outputTokens: row.outputTokens ?? undefined,
    totalTokens:
      row.inputTokens != null && row.outputTokens != null
        ? row.inputTokens + row.outputTokens
        : undefined,
    numTurns: row.numTurns ?? undefined,
    costUsd: row.costUsd ?? undefined,
    model: row.model ?? undefined,
  }
}

export function dbAddTaskRun(run: TaskRun): void {
  db.insert(taskRuns).values({
    id: run.id,
    taskId: run.taskId,
    taskTitle: run.taskTitle,
    projectId: run.projectId,
    projectName: run.projectName,
    agentId: run.agentId,
    role: run.role,
    status: run.status,
    output: run.output,
    error: run.error ?? null,
    rawLog: run.rawLog ?? null,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    inputTokens: run.inputTokens ?? null,
    outputTokens: run.outputTokens ?? null,
    numTurns: run.numTurns ?? null,
    costUsd: run.costUsd ?? null,
    model: run.model ?? null,
  }).run()
}

export function dbGetAllTaskRuns(): TaskRun[] {
  return db
    .select()
    .from(taskRuns)
    .orderBy(desc(taskRuns.completedAt))
    .all()
    .map(rowToTaskRun)
}

export function dbGetTaskRunsByTask(taskId: string): TaskRun[] {
  return db
    .select()
    .from(taskRuns)
    .where(eq(taskRuns.taskId, taskId))
    .orderBy(desc(taskRuns.completedAt))
    .all()
    .map(rowToTaskRun)
}

export interface GetTaskRunsOpts {
  page: number
  limit: number
  role?: string
  status?: string
  /** Full-text search across title, project, output, and error fields */
  q?: string
  /** completedAt >= from (epoch ms) */
  from?: number
  /** completedAt <= to (epoch ms) */
  to?: number
}

/**
 * Returns a paginated slice of task runs, plus the total matching count.
 * All filtering is done in SQLite so the client only receives one page of data.
 */
export function dbGetTaskRunsPaginated(opts: GetTaskRunsOpts): { runs: TaskRun[]; total: number } {
  // Build WHERE conditions incrementally
  const conditions: (SQL | undefined)[] = []

  if (opts.role && opts.role !== 'all') {
    conditions.push(eq(taskRuns.role, opts.role))
  }

  if (opts.status && opts.status !== 'all') {
    conditions.push(eq(taskRuns.status, opts.status))
  }

  if (opts.q) {
    // Escape SQLite LIKE special characters (%, _, \) so user input is treated
    // as a literal substring rather than a wildcard pattern.
    const escaped = opts.q.replace(/[%_\\]/g, '\\$&')
    const pattern = `%${escaped}%`

    // Drizzle's like() helper has no ESCAPE clause support, so we use the sql
    // template tag to emit a proper "LIKE ? ESCAPE '\'" fragment for each column.
    const likeEscape = (col: SQL | unknown) =>
      sql`${col} LIKE ${pattern} ESCAPE '\\'`

    const textMatch = or(
      likeEscape(taskRuns.taskTitle),
      likeEscape(taskRuns.projectName),
      likeEscape(taskRuns.output),
      likeEscape(taskRuns.error),
    )
    if (textMatch) conditions.push(textMatch)
  }

  if (opts.from !== undefined) {
    conditions.push(gte(taskRuns.completedAt, opts.from))
  }

  if (opts.to !== undefined) {
    conditions.push(lte(taskRuns.completedAt, opts.to))
  }

  // and() returns undefined when given an empty array, which is fine — .where(undefined) means no filter
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Run a lightweight COUNT(*) first so we know the total for pagination UI
  const countResult = db
    .select({ count: count() })
    .from(taskRuns)
    .where(whereClause)
    .get()
  const total = countResult?.count ?? 0

  // Fetch exactly one page of results
  const offset = (opts.page - 1) * opts.limit
  const rows = db
    .select()
    .from(taskRuns)
    .where(whereClause)
    .orderBy(desc(taskRuns.completedAt))
    .limit(opts.limit)
    .offset(offset)
    .all()

  return { runs: rows.map(rowToTaskRun), total }
}
