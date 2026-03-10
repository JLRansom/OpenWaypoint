/**
 * Integration tests — DELETE /api/tasks/[id]/files/[fileId]
 *
 * The delete route must:
 *  1. Verify the task exists → 404 if not
 *  2. Verify the file record exists → 404 if not
 *  3. Verify file ownership (file.taskId === taskId) → 403 if mismatch
 *  4. Delete the DB record FIRST, then attempt disk removal (best-effort)
 *  5. Return 204 No Content on success
 *  6. Skip disk removal (but still 204) if storagePath is a traversal path
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { DELETE } from '@/app/api/tasks/[id]/files/[fileId]/route'
import { addProject, addTask, addTaskFile, getTaskFile, getFilesByTask } from '@/lib/store'
import {
  makeTestProject,
  makeTestTask,
  fixtureBuffer,
  cleanupTaskUploads,
  createDeleteRequest,
} from '../helpers/test-utils'
import type { TaskFile } from '@/lib/types'

// ─── Shared state ─────────────────────────────────────────────────────────────

let projectId: string
let taskId: string
let otherTaskId: string   // A second task to test ownership rejection

beforeAll(() => {
  const project = makeTestProject()
  addProject(project)
  projectId = project.id

  const task = makeTestTask(projectId)
  addTask(task)
  taskId = task.id

  const otherTask = makeTestTask(projectId)
  addTask(otherTask)
  otherTaskId = otherTask.id
})

afterAll(() => {
  cleanupTaskUploads(taskId)
  cleanupTaskUploads(otherTaskId)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params(id: string, fileId: string) {
  return { params: Promise.resolve({ id, fileId }) }
}

/**
 * Seeds a TaskFile record and writes the bytes to disk.
 * Returns the record so the test can reference its ID.
 */
function seedFile(forTaskId = taskId, overrides: Partial<TaskFile> = {}): TaskFile {
  const content = fixtureBuffer('test-file.txt')
  const diskName = `${randomUUID()}-seeded.txt`
  const dir = join(process.cwd(), 'data', 'uploads', forTaskId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, diskName), content)

  const record: TaskFile = {
    id: randomUUID(),
    taskId: forTaskId,
    filename: 'seeded.txt',
    mimeType: 'text/plain',
    sizeBytes: content.length,
    storagePath: ['data', 'uploads', forTaskId, diskName].join('/'),
    createdAt: Date.now(),
    ...overrides,
  }
  addTaskFile(record)
  return record
}

/** Full disk path for a TaskFile's storagePath. */
function diskPath(record: TaskFile): string {
  return join(process.cwd(), ...record.storagePath.split('/'))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DELETE /api/tasks/[id]/files/[fileId] — success', () => {
  it('returns 204 when deleting an existing file', async () => {
    const record = seedFile()

    const req = createDeleteRequest(taskId, record.id)
    const res = await DELETE(req, params(taskId, record.id))

    expect(res.status).toBe(204)
  })

  it('removes the DB record after successful delete', async () => {
    const record = seedFile()
    const req = createDeleteRequest(taskId, record.id)
    await DELETE(req, params(taskId, record.id))

    expect(getTaskFile(record.id)).toBeUndefined()
  })

  it('removes the file from disk after successful delete', async () => {
    const record = seedFile()
    const path = diskPath(record)
    expect(existsSync(path)).toBe(true)

    const req = createDeleteRequest(taskId, record.id)
    await DELETE(req, params(taskId, record.id))

    expect(existsSync(path)).toBe(false)
  })

  it('does not appear in the task file list after deletion', async () => {
    const record = seedFile()
    const req = createDeleteRequest(taskId, record.id)
    await DELETE(req, params(taskId, record.id))

    const files = getFilesByTask(taskId)
    expect(files.find(f => f.id === record.id)).toBeUndefined()
  })
})

describe('DELETE /api/tasks/[id]/files/[fileId] — error cases', () => {
  it('returns 404 for a non-existent task', async () => {
    const fakeTaskId = randomUUID()
    const fakeFileId = randomUUID()
    const req = createDeleteRequest(fakeTaskId, fakeFileId)
    const res = await DELETE(req, params(fakeTaskId, fakeFileId))
    expect(res.status).toBe(404)
  })

  it('returns 404 for a non-existent file ID', async () => {
    const fakeFileId = randomUUID()
    const req = createDeleteRequest(taskId, fakeFileId)
    const res = await DELETE(req, params(taskId, fakeFileId))
    expect(res.status).toBe(404)
  })

  it('returns 403 when file belongs to a different task (ownership check)', async () => {
    // Seed a file attached to otherTaskId, then try to delete it via taskId
    const record = seedFile(otherTaskId)

    const req = createDeleteRequest(taskId, record.id)
    const res = await DELETE(req, params(taskId, record.id))

    expect(res.status).toBe(403)
    // The file record must still exist — we must NOT delete it
    expect(getTaskFile(record.id)).toBeDefined()
  })

  it('returns 204 (gracefully) when disk file is already missing', async () => {
    // Insert a record pointing to a file that does not exist on disk
    const diskName = `${randomUUID()}-already-gone.txt`
    const record: TaskFile = {
      id: randomUUID(),
      taskId,
      filename: 'already-gone.txt',
      mimeType: 'text/plain',
      sizeBytes: 0,
      storagePath: ['data', 'uploads', taskId, diskName].join('/'),
      createdAt: Date.now(),
    }
    addTaskFile(record)

    const req = createDeleteRequest(taskId, record.id)
    const res = await DELETE(req, params(taskId, record.id))

    // Should NOT throw; returns 204 and DB record is gone
    expect(res.status).toBe(204)
    expect(getTaskFile(record.id)).toBeUndefined()
  })
})

describe('DELETE /api/tasks/[id]/files/[fileId] — path traversal in storagePath', () => {
  it('returns 204 but skips disk unlink when storagePath escapes uploads root', async () => {
    // Manually craft a record with a traversal path.
    // The route should skip the unlink but still delete the DB record and return 204.
    const record: TaskFile = {
      id: randomUUID(),
      taskId,
      filename: 'traversal.txt',
      mimeType: 'text/plain',
      sizeBytes: 0,
      storagePath: '../../traversal.txt',
      createdAt: Date.now(),
    }
    addTaskFile(record)

    const req = createDeleteRequest(taskId, record.id)
    const res = await DELETE(req, params(taskId, record.id))

    expect(res.status).toBe(204)
    // DB record is gone — the traversal skips disk, not the DB deletion
    expect(getTaskFile(record.id)).toBeUndefined()
  })
})
