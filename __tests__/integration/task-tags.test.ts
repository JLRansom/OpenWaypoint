/**
 * Integration tests for the task tags feature.
 *
 * Covers:
 *  - GET /api/tasks/[id] returns tags field
 *  - PATCH /api/tasks/[id] with tags sets them
 *  - Tags are persisted and deserialized as arrays
 *  - Tag sanitisation (lowercase, dedup, max length, max count)
 *  - 404 on unknown task
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PATCH } from '@/app/api/tasks/[id]/route'
import { addProject, addTask } from '@/lib/store'
import { makeTestProject, makeTestTask } from '../helpers/test-utils'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function patchRequest(id: string, body: object): NextRequest {
  return new NextRequest(`http://localhost/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/tasks/${id}`)
}

describe('Task Tags API', () => {
  let projectId: string
  let taskId: string

  beforeEach(() => {
    const project = makeTestProject()
    const task = makeTestTask(project.id)
    addProject(project)
    addTask(task)
    projectId = project.id
    taskId = task.id
  })

  it('GET returns empty tags array by default', async () => {
    const res = await GET(getRequest(taskId), params(taskId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tags).toEqual([])
  })

  it('PATCH sets tags and they are returned in the response', async () => {
    const res = await PATCH(patchRequest(taskId, { tags: ['bug', 'approved'] }), params(taskId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.tags).toEqual(['bug', 'approved'])
  })

  it('PATCH persists tags so subsequent GET returns them', async () => {
    await PATCH(patchRequest(taskId, { tags: ['feature', 'tests-passed'] }), params(taskId))
    const res = await GET(getRequest(taskId), params(taskId))
    const body = await res.json()
    expect(body.tags).toEqual(['feature', 'tests-passed'])
  })

  it('PATCH sanitises tags: lowercases and trims whitespace', async () => {
    const res = await PATCH(patchRequest(taskId, { tags: ['  BUG  ', 'APPROVED'] }), params(taskId))
    const body = await res.json()
    expect(body.tags).toEqual(['bug', 'approved'])
  })

  it('PATCH deduplicates tags', async () => {
    const res = await PATCH(patchRequest(taskId, { tags: ['bug', 'bug', 'approved', 'bug'] }), params(taskId))
    const body = await res.json()
    expect(body.tags).toEqual(['bug', 'approved'])
  })

  it('PATCH truncates tags longer than 32 characters', async () => {
    const long = 'a'.repeat(50)
    const res = await PATCH(patchRequest(taskId, { tags: [long] }), params(taskId))
    const body = await res.json()
    expect(body.tags[0].length).toBe(32)
  })

  it('PATCH limits to 20 tags maximum', async () => {
    const many = Array.from({ length: 30 }, (_, i) => `tag-${i}`)
    const res = await PATCH(patchRequest(taskId, { tags: many }), params(taskId))
    const body = await res.json()
    expect(body.tags.length).toBe(20)
  })

  it('PATCH ignores empty string tags', async () => {
    const res = await PATCH(patchRequest(taskId, { tags: ['', '  ', 'valid'] }), params(taskId))
    const body = await res.json()
    expect(body.tags).toEqual(['valid'])
  })

  it('PATCH with no tags field leaves existing tags unchanged', async () => {
    await PATCH(patchRequest(taskId, { tags: ['existing'] }), params(taskId))
    const res = await PATCH(patchRequest(taskId, { title: 'New title' }), params(taskId))
    const body = await res.json()
    expect(body.tags).toEqual(['existing'])
  })

  it('PATCH with empty tags array clears all tags', async () => {
    await PATCH(patchRequest(taskId, { tags: ['to-remove'] }), params(taskId))
    const res = await PATCH(patchRequest(taskId, { tags: [] }), params(taskId))
    const body = await res.json()
    expect(body.tags).toEqual([])
  })

  it('returns 404 for unknown task', async () => {
    const res = await PATCH(patchRequest('no-such-id', { tags: ['x'] }), params('no-such-id'))
    expect(res.status).toBe(404)
  })
})
