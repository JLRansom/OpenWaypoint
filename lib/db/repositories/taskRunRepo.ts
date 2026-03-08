import { eq, desc } from 'drizzle-orm'
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
