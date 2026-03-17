import { eq } from 'drizzle-orm'
import { db } from '../client'
import { projectTags } from '../schema'
import type { ProjectTag } from '@/lib/types'

function rowToTag(row: typeof projectTags.$inferSelect): ProjectTag {
  return {
    id:        row.id,
    projectId: row.projectId,
    name:      row.name,
    color:     row.color,
    createdAt: row.createdAt,
  }
}

export function dbGetAllTags(): ProjectTag[] {
  return db.select().from(projectTags).all().map(rowToTag)
}

export function dbGetTagsByProject(projectId: string): ProjectTag[] {
  return db
    .select()
    .from(projectTags)
    .where(eq(projectTags.projectId, projectId))
    .all()
    .map(rowToTag)
}

export function dbGetTag(id: string): ProjectTag | undefined {
  const row = db
    .select()
    .from(projectTags)
    .where(eq(projectTags.id, id))
    .get()
  return row ? rowToTag(row) : undefined
}

export function dbAddTag(tag: ProjectTag): void {
  db.insert(projectTags).values({
    id:        tag.id,
    projectId: tag.projectId,
    name:      tag.name,
    color:     tag.color,
    createdAt: tag.createdAt,
  }).run()
}

export function dbUpdateTag(id: string, patch: Partial<Pick<ProjectTag, 'name' | 'color'>>): void {
  db.update(projectTags).set(patch).where(eq(projectTags.id, id)).run()
}

export function dbDeleteTag(id: string): void {
  db.delete(projectTags).where(eq(projectTags.id, id)).run()
}
