/**
 * Integration tests — POST /api/tasks/[id]/files (file upload)
 *
 * Tests call the route handler directly with synthetic NextRequest objects,
 * avoiding the need for a running server. Real disk I/O and a real (temp)
 * SQLite database are used so the full upload pipeline is exercised.
 *
 * Disk cleanup:
 *   Each test that creates files stores the task ID in `uploadedTaskIds` and
 *   afterAll removes those directories from data/uploads/.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/tasks/[id]/files/route'
import { addProject, addTask, getFilesByTask } from '@/lib/store'
import { MAX_FILE_SIZE } from '@/lib/file-utils'
import {
  makeTestProject,
  makeTestTask,
  createUploadRequest,
  fixtureBuffer,
  cleanupTaskUploads,
} from '../helpers/test-utils'

// ─── Shared state ─────────────────────────────────────────────────────────────

let projectId: string
let taskId: string
const uploadedTaskIds: string[] = []

beforeAll(() => {
  const project = makeTestProject()
  addProject(project)
  projectId = project.id

  const task = makeTestTask(projectId)
  addTask(task)
  taskId = task.id
  uploadedTaskIds.push(taskId)
})

afterAll(() => {
  // Remove every task directory we may have written to
  for (const id of uploadedTaskIds) {
    cleanupTaskUploads(id)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a params object matching Next.js App Router conventions. */
function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/tasks/[id]/files — valid uploads', () => {
  it('returns 201 and a saved entry when uploading a valid PNG', async () => {
    const png = fixtureBuffer('test-image.png')
    const req = createUploadRequest(taskId, [
      { name: 'test-image.png', type: 'image/png', content: png },
    ])

    const res = await POST(req, params(taskId))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.saved).toHaveLength(1)
    expect(body.errors).toHaveLength(0)
    expect(body.saved[0].taskId).toBe(taskId)
    expect(body.saved[0].filename).toBe('test-image.png')
    expect(body.saved[0].mimeType).toBe('image/png')
  })

  it('writes the file to disk and the bytes match the original', async () => {
    const original = fixtureBuffer('test-image.png')
    const req = createUploadRequest(taskId, [
      { name: 'roundtrip.png', type: 'image/png', content: original },
    ])

    const res = await POST(req, params(taskId))
    const { saved } = await res.json()
    const record = saved[0]

    // storagePath is forward-slash-separated; join resolves to OS path
    const diskPath = join(process.cwd(), ...record.storagePath.split('/'))
    expect(existsSync(diskPath)).toBe(true)

    const onDisk = readFileSync(diskPath)
    expect(onDisk).toEqual(original)
  })

  it('stores sizeBytes equal to actual buffer length (not browser-reported size)', async () => {
    const buf = fixtureBuffer('test-file.txt')
    const req = createUploadRequest(taskId, [
      { name: 'test-file.txt', type: 'text/plain', content: buf },
    ])

    const res = await POST(req, params(taskId))
    const { saved } = await res.json()

    expect(saved[0].sizeBytes).toBe(buf.length)
  })

  it('uploads multiple files in one request', async () => {
    const png = fixtureBuffer('test-image.png')
    const txt = fixtureBuffer('test-file.txt')
    const json = fixtureBuffer('test-file.json')

    const req = createUploadRequest(taskId, [
      { name: 'a.png', type: 'image/png', content: png },
      { name: 'b.txt', type: 'text/plain', content: txt },
      { name: 'c.json', type: 'application/json', content: json },
    ])

    const res = await POST(req, params(taskId))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.saved).toHaveLength(3)
    expect(body.errors).toHaveLength(0)
  })

  it('storagePath uses forward slashes regardless of OS', async () => {
    const buf = fixtureBuffer('test-file.txt')
    const req = createUploadRequest(taskId, [
      { name: 'slash-test.txt', type: 'text/plain', content: buf },
    ])

    const res = await POST(req, params(taskId))
    const { saved } = await res.json()

    const storagePath: string = saved[0].storagePath
    expect(storagePath).not.toContain('\\')
    expect(storagePath).toMatch(/^data\/uploads\/.+\/.+$/)
  })

  it('storagePath contains the correct task ID', async () => {
    const buf = fixtureBuffer('test-file.txt')
    const req = createUploadRequest(taskId, [
      { name: 'check-id.txt', type: 'text/plain', content: buf },
    ])

    const res = await POST(req, params(taskId))
    const { saved } = await res.json()

    expect(saved[0].storagePath).toContain(taskId)
  })

  it('persists the record in the database', async () => {
    const before = getFilesByTask(taskId).length
    const buf = fixtureBuffer('test-file.json')
    const req = createUploadRequest(taskId, [
      { name: 'persist-check.json', type: 'application/json', content: buf },
    ])

    await POST(req, params(taskId))

    const after = getFilesByTask(taskId).length
    expect(after).toBeGreaterThan(before)
  })
})

describe('POST /api/tasks/[id]/files — rejected files', () => {
  it('rejects a disallowed MIME type and puts it in errors array', async () => {
    const buf = Buffer.from('MZ\x90\x00') // fake EXE header
    const req = createUploadRequest(taskId, [
      { name: 'malware.exe', type: 'application/exe', content: buf },
    ])

    const res = await POST(req, params(taskId))
    // Single rejected file → no saved files → 400
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details[0].error).toMatch(/unsupported file type/)
  })

  it('accepts valid files and rejects disallowed ones in the same request', async () => {
    const good = fixtureBuffer('test-file.txt')
    const bad = Buffer.from('<?php echo "evil"; ?>')

    const req = createUploadRequest(taskId, [
      { name: 'good.txt', type: 'text/plain', content: good },
      { name: 'bad.php', type: 'application/x-php', content: bad },
    ])

    const res = await POST(req, params(taskId))
    // At least one saved → 201
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.saved).toHaveLength(1)
    expect(body.errors).toHaveLength(1)
    expect(body.errors[0].filename).toBe('bad.php')
  })

  it('rejects a file that exceeds the 50 MB size limit', async () => {
    // Build a buffer slightly over MAX_FILE_SIZE
    const tooBig = Buffer.alloc(MAX_FILE_SIZE + 1, 0x42)
    const req = createUploadRequest(taskId, [
      { name: 'huge.txt', type: 'text/plain', content: tooBig },
    ])

    const res = await POST(req, params(taskId))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.details[0].error).toMatch(/50 MB/)
  })
})

describe('POST /api/tasks/[id]/files — error cases', () => {
  it('returns 404 for a non-existent task', async () => {
    const nonExistentId = randomUUID()
    const req = createUploadRequest(nonExistentId, [
      { name: 'file.txt', type: 'text/plain', content: Buffer.from('x') },
    ])

    const res = await POST(req, { params: Promise.resolve({ id: nonExistentId }) })
    expect(res.status).toBe(404)
  })

  it('returns 400 when no file field is present', async () => {
    // FormData with a non-file field
    const formData = new FormData()
    formData.append('other', 'value')
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}/files`, {
      method: 'POST',
      body: formData,
    })

    const res = await POST(req, params(taskId))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no files provided/)
  })

  it('returns 400 for an invalid multipart body', async () => {
    // Send plain text instead of multipart — triggers formData() parse error
    const req = new NextRequest(`http://localhost/api/tasks/${taskId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=INVALID' },
      body: 'this is not valid multipart data',
    })

    const res = await POST(req, params(taskId))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid multipart body/)
  })
})

describe('GET /api/tasks/[id]/files', () => {
  it('returns 200 and lists files for an existing task', async () => {
    // First upload something so the list is non-empty
    const buf = fixtureBuffer('test-file.txt')
    const uploadReq = createUploadRequest(taskId, [
      { name: 'list-test.txt', type: 'text/plain', content: buf },
    ])
    await POST(uploadReq, params(taskId))

    const listReq = new NextRequest(`http://localhost/api/tasks/${taskId}/files`)
    const res = await GET(listReq, params(taskId))

    expect(res.status).toBe(200)
    const files = await res.json()
    expect(Array.isArray(files)).toBe(true)
    expect(files.length).toBeGreaterThan(0)
    expect(files[0]).toMatchObject({
      id: expect.any(String),
      taskId,
      filename: expect.any(String),
      mimeType: expect.any(String),
    })
  })

  it('returns 404 for a non-existent task', async () => {
    const fakeId = randomUUID()
    const req = new NextRequest(`http://localhost/api/tasks/${fakeId}/files`)
    const res = await GET(req, { params: Promise.resolve({ id: fakeId }) })
    expect(res.status).toBe(404)
  })
})
