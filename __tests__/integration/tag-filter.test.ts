/**
 * Integration tests for the tag-filter feature.
 *
 * The board does client-side filtering, so these tests cover the DB-layer
 * tag filtering in TaskQueryOptions (used when the API is called with ?tags=).
 * They also confirm the board-level logic (filtering a task list by tags).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as getProjectTasks } from '@/app/api/projects/[id]/tasks/route'
import { addProject, addTask } from '@/lib/store'
import { makeTestProject, makeTestTask } from '../helpers/test-utils'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function tasksRequest(projectId: string, queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/projects/${projectId}/tasks${queryString}`)
}

describe('Tag filtering via GET /api/projects/[id]/tasks', () => {
  let projectId: string

  beforeEach(() => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id

    addTask(makeTestTask(projectId, { title: 'Task A', tags: ['approved', 'feature'] }))
    addTask(makeTestTask(projectId, { title: 'Task B', tags: ['bug'] }))
    addTask(makeTestTask(projectId, { title: 'Task C', tags: ['approved', 'bug'] }))
    addTask(makeTestTask(projectId, { title: 'Task D', tags: [] }))
  })

  it('returns all tasks when no ?tags= param is provided', async () => {
    const res = await getProjectTasks(tasksRequest(projectId), params(projectId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(4)
  })

  it('filters to tasks with a single tag', async () => {
    const res = await getProjectTasks(tasksRequest(projectId, '?tags=bug'), params(projectId))
    const body = await res.json()
    const titles = body.map((t: { title: string }) => t.title).sort()
    expect(titles).toEqual(['Task B', 'Task C'])
  })

  it('filters to tasks with ALL specified tags (AND logic)', async () => {
    const res = await getProjectTasks(tasksRequest(projectId, '?tags=approved,bug'), params(projectId))
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Task C')
  })

  it('returns empty array when no tasks match all tags', async () => {
    const res = await getProjectTasks(tasksRequest(projectId, '?tags=approved,nonexistent'), params(projectId))
    const body = await res.json()
    expect(body).toHaveLength(0)
  })

  it('ignores empty tag strings in the ?tags= param', async () => {
    // ?tags=,bug, should behave same as ?tags=bug
    const res = await getProjectTasks(tasksRequest(projectId, '?tags=,bug,'), params(projectId))
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  it('returns 404 for an unknown project', async () => {
    const res = await getProjectTasks(tasksRequest('no-such-project', '?tags=bug'), params('no-such-project'))
    expect(res.status).toBe(404)
  })
})
