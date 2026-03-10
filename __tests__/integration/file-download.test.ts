/**
 * Integration tests — GET /api/files/[id]/content (file download)
 *
 * Tests the download route handler directly. Files are created on disk and
 * records inserted via the store so we can exercise the full path without
 * needing a running server.
 *
 * Key scenarios:
 *  - Happy-path PNG (inline) and text (attachment) downloads
 *  - Path traversal guard → 403
 *  - Missing DB record → 404
 *  - Missing disk file → 404
 *  - Content-Length accuracy
 *  - Cache-Control header
 *  - Content-Disposition filename sanitisation
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/files/[id]/content/route'
import { addProject, addTask, addTaskFile, getTask } from '@/lib/store'
import {
  makeTestProject,
  makeTestTask,
  fixtureBuffer,
  cleanupTaskUploads,
  createDownloadRequest,
} from '../helpers/test-utils'
import type { TaskFile } from '@/lib/types'

// ─── Shared state ─────────────────────────────────────────────────────────────

let projectId: string
let taskId: string

/**
 * Inserts a TaskFile record + writes the actual bytes to disk.
 *
 * Key design: the on-disk filename is always a safe UUID-only name so that
 * tests running on Windows (which forbids `"`, `\n`, `\` in filenames) can
 * store "malicious" display names in the DB `filename` field without issues.
 * Content-Disposition sanitisation tests set `filename` to values with
 * illegal OS characters — those values live only in the DB, never on disk.
 */
function seedFile(
  overrides: Partial<TaskFile> & { content?: Buffer } = {}
): TaskFile {
  const { content = Buffer.from('test content'), ...rest } = overrides
  // Always use a safe, UUID-only disk name — separates display name from path
  const safeDiskName = `${randomUUID()}-seed`
  const dir = join(process.cwd(), 'data', 'uploads', taskId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, safeDiskName), content)

  const record: TaskFile = {
    id: randomUUID(),
    taskId,
    filename: rest.filename ?? 'seed.txt',   // DB display name (may contain special chars)
    mimeType: rest.mimeType ?? 'text/plain',
    sizeBytes: content.length,
    // storagePath always points to the safe disk file
    storagePath: ['data', 'uploads', taskId, safeDiskName].join('/'),
    createdAt: Date.now(),
    ...rest,
    // Allow an explicit storagePath override (e.g. traversal tests)
    ...(rest.storagePath !== undefined ? { storagePath: rest.storagePath } : {}),
  }
  addTaskFile(record)
  return record
}

beforeAll(() => {
  const project = makeTestProject()
  addProject(project)
  projectId = project.id

  const task = makeTestTask(projectId)
  addTask(task)
  taskId = task.id
})

afterAll(() => {
  cleanupTaskUploads(taskId)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/files/[id]/content — PNG (inline)', () => {
  it('returns 200 with Content-Type: image/png', async () => {
    const png = fixtureBuffer('test-image.png')
    const record = seedFile({ filename: 'logo.png', mimeType: 'image/png', content: png })

    const req = createDownloadRequest(record.id)
    const res = await GET(req, params(record.id))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('returns inline Content-Disposition for images', async () => {
    const png = fixtureBuffer('test-image.png')
    const record = seedFile({ filename: 'photo.png', mimeType: 'image/png', content: png })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toMatch(/^inline;/)
    expect(disposition).toContain('photo.png')
  })

  it('returns Content-Length equal to the actual file size', async () => {
    const png = fixtureBuffer('test-image.png')
    const record = seedFile({ filename: 'size-check.png', mimeType: 'image/png', content: png })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    expect(res.headers.get('Content-Length')).toBe(String(png.length))
  })

  it('returns the correct bytes in the response body', async () => {
    const png = fixtureBuffer('test-image.png')
    const record = seedFile({ filename: 'bytes-check.png', mimeType: 'image/png', content: png })

    const res = await GET(createDownloadRequest(record.id), params(record.id))
    const body = Buffer.from(await res.arrayBuffer())

    expect(body).toEqual(png)
  })
})

describe('GET /api/files/[id]/content — text file (attachment)', () => {
  it('returns 200 with Content-Type: text/plain', async () => {
    const txt = fixtureBuffer('test-file.txt')
    const record = seedFile({ filename: 'readme.txt', mimeType: 'text/plain', content: txt })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain')
  })

  it('returns attachment Content-Disposition for text files', async () => {
    const txt = fixtureBuffer('test-file.txt')
    const record = seedFile({ filename: 'notes.txt', mimeType: 'text/plain', content: txt })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    const disposition = res.headers.get('Content-Disposition')
    expect(disposition).toMatch(/^attachment;/)
    expect(disposition).toContain('notes.txt')
  })
})

describe('GET /api/files/[id]/content — Cache-Control', () => {
  it('returns Cache-Control: private, max-age=3600', async () => {
    const record = seedFile()

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
  })
})

describe('GET /api/files/[id]/content — Content-Disposition sanitisation', () => {
  it('strips double-quotes from filename', async () => {
    const record = seedFile({ filename: 'bad"name.txt', mimeType: 'text/plain' })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    const disposition = res.headers.get('Content-Disposition')!
    // The outer filename="..." wrapper contains the sanitised name
    expect(disposition).not.toContain('"bad"name')
    expect(disposition).toContain('bad_name.txt')
  })

  it('strips newlines from filename', async () => {
    const record = seedFile({ filename: 'line\nbreak.txt', mimeType: 'text/plain' })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    const disposition = res.headers.get('Content-Disposition')!
    expect(disposition).not.toContain('\n')
    expect(disposition).toContain('line_break.txt')
  })

  it('strips backslashes from filename', async () => {
    const record = seedFile({ filename: 'path\\file.txt', mimeType: 'text/plain' })

    const res = await GET(createDownloadRequest(record.id), params(record.id))

    const disposition = res.headers.get('Content-Disposition')!
    expect(disposition).not.toContain('\\')
    expect(disposition).toContain('path_file.txt')
  })
})

describe('GET /api/files/[id]/content — error cases', () => {
  it('returns 404 for a non-existent file ID', async () => {
    const fakeId = randomUUID()
    const res = await GET(createDownloadRequest(fakeId), params(fakeId))
    expect(res.status).toBe(404)
  })

  it('returns 404 when DB record exists but file is missing from disk', async () => {
    // Insert a record whose storagePath points to a file we never actually create
    const diskName = `${randomUUID()}-ghost.txt`
    const record: TaskFile = {
      id: randomUUID(),
      taskId,
      filename: 'ghost.txt',
      mimeType: 'text/plain',
      sizeBytes: 10,
      storagePath: ['data', 'uploads', taskId, diskName].join('/'),
      createdAt: Date.now(),
    }
    addTaskFile(record)

    // Verify the file truly isn't there
    const diskPath = join(process.cwd(), 'data', 'uploads', taskId, diskName)
    expect(existsSync(diskPath)).toBe(false)

    const res = await GET(createDownloadRequest(record.id), params(record.id))
    expect(res.status).toBe(404)
  })

  it('returns 403 for a path-traversal storagePath', async () => {
    // Manually insert a malicious record with a traversal path.
    // The route must NOT follow the traversal — it should return 403.
    const record: TaskFile = {
      id: randomUUID(),
      taskId,
      filename: 'passwd',
      mimeType: 'text/plain',
      sizeBytes: 100,
      // Two levels up — resolves outside data/uploads on every OS
      storagePath: '../../etc/passwd',
      createdAt: Date.now(),
    }
    addTaskFile(record)

    const res = await GET(createDownloadRequest(record.id), params(record.id))
    expect(res.status).toBe(403)
  })
})
