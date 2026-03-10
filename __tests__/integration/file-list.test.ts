/**
 * Integration tests — GET /api/tasks/[id]/files (list files for a task)
 *
 * Simpler than the upload tests — focuses on the listing behaviour:
 *  - Returns all records for a task with files
 *  - Returns an empty array for a task with no files
 *  - Returns 404 for a non-existent task
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/tasks/[id]/files/route'
import { addProject, addTask, addTaskFile } from '@/lib/store'
import {
  makeTestProject,
  makeTestTask,
  fixtureBuffer,
  cleanupTaskUploads,
} from '../helpers/test-utils'
import type { TaskFile } from '@/lib/types'

// ─── Shared state ─────────────────────────────────────────────────────────────

let projectId: string
let taskWithFilesId: string
let emptyTaskId: string

beforeAll(() => {
  const project = makeTestProject()
  addProject(project)
  projectId = project.id

  // Task that will have files attached
  const taskWithFiles = makeTestTask(projectId)
  addTask(taskWithFiles)
  taskWithFilesId = taskWithFiles.id

  // Task that intentionally has NO files
  const emptyTask = makeTestTask(projectId)
  addTask(emptyTask)
  emptyTaskId = emptyTask.id

  // Seed three files onto taskWithFilesId
  const dir = join(process.cwd(), 'data', 'uploads', taskWithFilesId)
  mkdirSync(dir, { recursive: true })

  const fixtures = [
    { name: 'test-image.png', type: 'image/png' },
    { name: 'test-file.txt', type: 'text/plain' },
    { name: 'test-file.json', type: 'application/json' },
  ]

  for (const fixture of fixtures) {
    const content = fixtureBuffer(fixture.name)
    const diskName = `${randomUUID()}-${fixture.name}`
    writeFileSync(join(dir, diskName), content)

    const record: TaskFile = {
      id: randomUUID(),
      taskId: taskWithFilesId,
      filename: fixture.name,
      mimeType: fixture.type,
      sizeBytes: content.length,
      storagePath: ['data', 'uploads', taskWithFilesId, diskName].join('/'),
      createdAt: Date.now(),
    }
    addTaskFile(record)
  }
})

afterAll(() => {
  cleanupTaskUploads(taskWithFilesId)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost/api/tasks/${id}/files`)
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/tasks/[id]/files — task with attachments', () => {
  it('returns 200', async () => {
    const res = await GET(makeGetRequest(taskWithFilesId), params(taskWithFilesId))
    expect(res.status).toBe(200)
  })

  it('returns an array with the correct number of records', async () => {
    const res = await GET(makeGetRequest(taskWithFilesId), params(taskWithFilesId))
    const files = await res.json()
    expect(Array.isArray(files)).toBe(true)
    expect(files).toHaveLength(3)
  })

  it('each record has the required shape', async () => {
    const res = await GET(makeGetRequest(taskWithFilesId), params(taskWithFilesId))
    const files = await res.json()

    for (const file of files) {
      expect(file).toMatchObject({
        id: expect.any(String),
        taskId: taskWithFilesId,
        filename: expect.any(String),
        mimeType: expect.any(String),
        sizeBytes: expect.any(Number),
        storagePath: expect.any(String),
        createdAt: expect.any(Number),
      })
    }
  })

  it('storagePaths use forward slashes', async () => {
    const res = await GET(makeGetRequest(taskWithFilesId), params(taskWithFilesId))
    const files = await res.json()

    for (const file of files) {
      expect(file.storagePath).not.toContain('\\')
    }
  })

  it('returns records only for the requested task (not other tasks)', async () => {
    const res = await GET(makeGetRequest(taskWithFilesId), params(taskWithFilesId))
    const files = await res.json()

    for (const file of files) {
      expect(file.taskId).toBe(taskWithFilesId)
    }
  })
})

describe('GET /api/tasks/[id]/files — empty task', () => {
  it('returns 200 with an empty array when the task has no attachments', async () => {
    const res = await GET(makeGetRequest(emptyTaskId), params(emptyTaskId))
    expect(res.status).toBe(200)
    const files = await res.json()
    expect(Array.isArray(files)).toBe(true)
    expect(files).toHaveLength(0)
  })
})

describe('GET /api/tasks/[id]/files — non-existent task', () => {
  it('returns 404 for a task ID that does not exist', async () => {
    const fakeId = randomUUID()
    const res = await GET(makeGetRequest(fakeId), { params: Promise.resolve({ id: fakeId }) })
    expect(res.status).toBe(404)
  })
})
