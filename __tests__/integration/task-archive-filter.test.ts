/**
 * Integration tests — GET /api/projects/[id]/tasks (archive filter)
 *
 * Calls the route handler directly with synthetic NextRequest objects.
 * Uses a real (temp) SQLite database so the full query pipeline is
 * exercised without a running server.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/projects/[id]/tasks/route'
import { addProject, addTask } from '@/lib/store'
import { makeTestProject, makeTestTask } from '../helpers/test-utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a params object matching Next.js App Router conventions. */
function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

/** Builds a NextRequest for the tasks endpoint with optional query params. */
function tasksRequest(projectId: string, query: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/projects/${projectId}/tasks`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/projects/[id]/tasks — archive filter', () => {
  const project = makeTestProject()
  const activeTask1 = makeTestTask(project.id, { title: 'Active 1' })
  const activeTask2 = makeTestTask(project.id, { title: 'Active 2' })
  const archivedTask = makeTestTask(project.id, { title: 'Archived', archived: true })

  beforeAll(() => {
    addProject(project)
    addTask(activeTask1)
    addTask(activeTask2)
    addTask(archivedTask)
  })

  it('returns all tasks when no archived param is given', async () => {
    const res = await GET(tasksRequest(project.id), params(project.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
  })

  it('returns only active tasks when archived=false', async () => {
    const res = await GET(tasksRequest(project.id, { archived: 'false' }), params(project.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body.every((t: { archived?: boolean }) => !t.archived)).toBe(true)
  })

  it('returns only archived tasks when archived=true', async () => {
    const res = await GET(tasksRequest(project.id, { archived: 'true' }), params(project.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Archived')
    expect(body[0].archived).toBe(true)
  })

  it('returns all tasks when archived=all', async () => {
    const res = await GET(tasksRequest(project.id, { archived: 'all' }), params(project.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
  })

  it('returns 404 for a non-existent project', async () => {
    const res = await GET(tasksRequest('no-such-id'), params('no-such-id'))
    expect(res.status).toBe(404)
  })
})
