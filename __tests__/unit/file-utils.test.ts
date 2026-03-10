/**
 * Unit tests for lib/file-utils.ts
 *
 * These tests exercise pure functions with no mocking required — no DB, no
 * disk I/O (except ensureTaskUploadsDir which creates a real temp dir).
 */
import { describe, it, expect, afterAll } from 'vitest'
import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  uploadsRoot,
  taskUploadsDir,
  ensureTaskUploadsDir,
  sanitiseFilename,
} from '@/lib/file-utils'

// ─── sanitiseFilename ────────────────────────────────────────────────────────

describe('sanitiseFilename', () => {
  it('leaves a clean filename unchanged', () => {
    expect(sanitiseFilename('normal.png')).toBe('normal.png')
  })

  it('strips directory components, keeping only the basename', () => {
    // path.basename("path/../../etc/passwd") === "passwd"
    expect(sanitiseFilename('path/../../etc/passwd')).toBe('passwd')
  })

  it('strips directory components on Windows-style paths', () => {
    // path.basename on any platform strips everything before the last separator
    const result = sanitiseFilename('C:\\Users\\attacker\\evil.exe')
    // Should be just "evil.exe" with extension dot kept but .exe kept (dot is allowed)
    expect(result).toBe('evil.exe')
  })

  it('replaces spaces and parentheses with underscores', () => {
    expect(sanitiseFilename('hello world (1).png')).toBe('hello_world__1_.png')
  })

  it('replaces special characters with underscores', () => {
    expect(sanitiseFilename('file@#$%name!.txt')).toBe('file____name_.txt')
  })

  it('truncates names longer than 200 characters', () => {
    const longName = 'a'.repeat(300) + '.txt'
    const result = sanitiseFilename(longName)
    expect(result.length).toBeLessThanOrEqual(200)
    // The slice cuts at 200, so the extension is dropped if the stem fills all 200
    expect(result).toBe('a'.repeat(200))
  })

  it('returns an empty string for empty input without throwing', () => {
    expect(() => sanitiseFilename('')).not.toThrow()
    expect(sanitiseFilename('')).toBe('')
  })

  it('handles filenames with only underscores and dashes (already safe)', () => {
    expect(sanitiseFilename('my-file_2024.md')).toBe('my-file_2024.md')
  })

  it('allows dots in filenames (for extensions)', () => {
    expect(sanitiseFilename('archive.tar.gz')).toBe('archive.tar.gz')
  })
})

// ─── ALLOWED_MIME_TYPES ───────────────────────────────────────────────────────

describe('ALLOWED_MIME_TYPES', () => {
  it('is a Set', () => {
    expect(ALLOWED_MIME_TYPES).toBeInstanceOf(Set)
  })

  it('allows image/png', () => {
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true)
  })

  it('allows image/jpeg', () => {
    expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true)
  })

  it('allows application/pdf', () => {
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true)
  })

  it('allows text/plain', () => {
    expect(ALLOWED_MIME_TYPES.has('text/plain')).toBe(true)
  })

  it('allows application/json', () => {
    expect(ALLOWED_MIME_TYPES.has('application/json')).toBe(true)
  })

  it('rejects application/octet-stream', () => {
    expect(ALLOWED_MIME_TYPES.has('application/octet-stream')).toBe(false)
  })

  it('rejects application/exe', () => {
    expect(ALLOWED_MIME_TYPES.has('application/exe')).toBe(false)
  })

  it('rejects video/mp4', () => {
    expect(ALLOWED_MIME_TYPES.has('video/mp4')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(ALLOWED_MIME_TYPES.has('')).toBe(false)
  })
})

// ─── MAX_FILE_SIZE ────────────────────────────────────────────────────────────

describe('MAX_FILE_SIZE', () => {
  it('equals exactly 50 MB (50 * 1024 * 1024)', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024)
  })

  it('equals 52428800 bytes', () => {
    expect(MAX_FILE_SIZE).toBe(52_428_800)
  })
})

// ─── uploadsRoot ──────────────────────────────────────────────────────────────

describe('uploadsRoot', () => {
  it('returns a string', () => {
    expect(typeof uploadsRoot()).toBe('string')
  })

  it('ends with data/uploads (using OS separators)', () => {
    const root = uploadsRoot()
    // Normalise to forward slashes for cross-platform assertion
    const normalised = root.replace(/\\/g, '/')
    expect(normalised.endsWith('data/uploads')).toBe(true)
  })

  it('is an absolute path', () => {
    const root = uploadsRoot()
    // An absolute path is either /... (Unix) or X:\... (Windows)
    expect(root.startsWith('/') || /^[A-Za-z]:[/\\]/.test(root)).toBe(true)
  })
})

// ─── taskUploadsDir ───────────────────────────────────────────────────────────

describe('taskUploadsDir', () => {
  it('ends with data/uploads/{taskId}', () => {
    const taskId = 'test-task-123'
    const dir = taskUploadsDir(taskId).replace(/\\/g, '/')
    expect(dir.endsWith(`data/uploads/${taskId}`)).toBe(true)
  })

  it('is a subdirectory of uploadsRoot', () => {
    const taskId = 'abc'
    const root = uploadsRoot().replace(/\\/g, '/')
    const dir = taskUploadsDir(taskId).replace(/\\/g, '/')
    expect(dir.startsWith(root)).toBe(true)
  })
})

// ─── ensureTaskUploadsDir ─────────────────────────────────────────────────────

describe('ensureTaskUploadsDir', () => {
  // Track dirs we create so we can clean up
  const createdDirs: string[] = []

  afterAll(() => {
    for (const dir of createdDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('creates the directory and returns its path', () => {
    const taskId = `test-ensure-${Date.now()}`
    const result = ensureTaskUploadsDir(taskId)
    createdDirs.push(result)

    expect(existsSync(result)).toBe(true)
    const normalised = result.replace(/\\/g, '/')
    expect(normalised.endsWith(`data/uploads/${taskId}`)).toBe(true)
  })

  it('is idempotent — calling twice does not throw', () => {
    const taskId = `test-idempotent-${Date.now()}`
    const dir1 = ensureTaskUploadsDir(taskId)
    createdDirs.push(dir1)
    expect(() => ensureTaskUploadsDir(taskId)).not.toThrow()
  })

  it('returns a path under uploadsRoot', () => {
    const taskId = `test-subdir-${Date.now()}`
    const result = ensureTaskUploadsDir(taskId)
    createdDirs.push(result)

    const root = uploadsRoot()
    // path.join normalises separators, so compare with join
    expect(result.startsWith(root)).toBe(true)
  })
})
