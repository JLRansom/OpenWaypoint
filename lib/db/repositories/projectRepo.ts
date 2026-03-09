import { eq } from 'drizzle-orm'
import { db } from '../client'
import { projects } from '../schema'
import { Project, BoardType } from '@/lib/types'
import type { ExecutorConfig } from '@/lib/executors/types'

type ProjectRow = typeof projects.$inferSelect

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    directory: row.directory ?? undefined,
    boardType: row.boardType as BoardType,
    executorConfig: row.executorConfig
      ? (JSON.parse(row.executorConfig) as ExecutorConfig)
      : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function dbGetAllProjects(): Project[] {
  return db
    .select()
    .from(projects)
    .orderBy(projects.createdAt)
    .all()
    .map(rowToProject)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function dbGetProject(id: string): Project | undefined {
  const row = db.select().from(projects).where(eq(projects.id, id)).get()
  return row ? rowToProject(row) : undefined
}

export function dbAddProject(project: Project): void {
  db.insert(projects).values({
    id: project.id,
    name: project.name,
    description: project.description,
    directory: project.directory ?? null,
    boardType: project.boardType ?? 'coding',
    executorConfig: project.executorConfig ? JSON.stringify(project.executorConfig) : null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }).run()
}

export function dbUpdateProject(id: string, patch: Partial<Project>): void {
  const update: Partial<typeof projects.$inferInsert> = {}

  if (patch.name !== undefined) update.name = patch.name
  if (patch.description !== undefined) update.description = patch.description
  if ('directory' in patch) update.directory = patch.directory ?? null
  if (patch.boardType !== undefined) update.boardType = patch.boardType
  if ('executorConfig' in patch) update.executorConfig = patch.executorConfig ? JSON.stringify(patch.executorConfig) : null
  if (patch.updatedAt !== undefined) update.updatedAt = patch.updatedAt

  if (Object.keys(update).length === 0) return

  db.update(projects).set(update).where(eq(projects.id, id)).run()
}
