/**
 * Shared test utilities for file I/O integration tests.
 *
 * Design decisions:
 *  - Factory functions (makeTestProject / makeTestTask) produce plain objects
 *    with random UUIDs — callers call addProject/addTask themselves so they
 *    can assert state before and after.
 *  - createUploadRequest wraps the native FormData + File globals available
 *    in Node 20+, which is what the real route handlers expect.
 *  - Cleanup helpers are thin wrappers so tests read clearly.
 */
import { randomUUID } from 'crypto'
import { readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { NextRequest } from 'next/server'
import type { Project, Task, TaskFile, TaskRun } from '@/lib/types'

// ─── Fixture helpers ────────────────────────────────────────────────────────

/** Absolute path to a fixture file in __tests__/fixtures/. */
export function fixturePath(filename: string): string {
  return join(__dirname, '..', 'fixtures', filename)
}

/** Read a fixture file into a Buffer. */
export function fixtureBuffer(filename: string): Buffer {
  return readFileSync(fixturePath(filename))
}

// ─── Test-data factories ─────────────────────────────────────────────────────

/** Creates a minimal valid Project object. Does NOT persist it — call addProject(). */
export function makeTestProject(overrides: Partial<Project> = {}): Project {
  return {
    id: randomUUID(),
    name: 'Test Project',
    description: 'Created by automated tests',
    boardType: 'general',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

/** Creates a minimal valid Task object. Does NOT persist it — call addTask(). */
export function makeTestTask(projectId: string, overrides: Partial<Task> = {}): Task {
  return {
    id: randomUUID(),
    projectId,
    title: 'Test Task',
    description: 'Created by automated tests',
    status: 'backlog',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

/** Creates a minimal valid TaskFile record. Does NOT persist it — call addTaskFile(). */
export function makeTaskFileRecord(
  taskId: string,
  diskName: string,
  overrides: Partial<TaskFile> = {}
): TaskFile {
  return {
    id: randomUUID(),
    taskId,
    filename: diskName,
    mimeType: 'text/plain',
    sizeBytes: 0,
    storagePath: ['data', 'uploads', taskId, diskName].join('/'),
    createdAt: Date.now(),
    ...overrides,
  }
}

/** Creates a minimal valid TaskRun object. Does NOT persist it — call dbAddTaskRun(). */
export function makeTestTaskRun(
  projectId: string,
  overrides: Partial<TaskRun> = {}
): TaskRun {
  const now = Date.now()
  return {
    id: randomUUID(),
    taskId: randomUUID(),
    taskTitle: 'Test Task',
    projectId,
    projectName: 'Test Project',
    agentId: randomUUID(),
    role: 'coder',
    status: 'done',
    output: '',
    startedAt: now - 60_000,
    completedAt: now,
    inputTokens: 1_000,
    outputTokens: 500,
    totalTokens: 1_500,
    numTurns: 2,
    costUsd: 0.01,
    model: 'claude-sonnet-4-6',
    ...overrides,
  }
}

// ─── Request builders ─────────────────────────────────────────────────────────

export interface UploadFile {
  name: string
  type: string
  content: Buffer
}

/**
 * Builds a NextRequest with a multipart/form-data body containing one or more
 * files attached under the `file` field — matching what FileDropZone sends.
 */
export function createUploadRequest(taskId: string, files: UploadFile[]): NextRequest {
  const formData = new FormData()
  for (const f of files) {
    formData.append('file', new File([f.content], f.name, { type: f.type }))
  }
  return new NextRequest(`http://localhost/api/tasks/${taskId}/files`, {
    method: 'POST',
    body: formData,
  })
}

/**
 * Builds a NextRequest for a file download.
 */
export function createDownloadRequest(fileId: string): NextRequest {
  return new NextRequest(`http://localhost/api/files/${fileId}/content`, {
    method: 'GET',
  })
}

/**
 * Builds a NextRequest for a DELETE file operation.
 */
export function createDeleteRequest(taskId: string, fileId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/tasks/${taskId}/files/${fileId}`,
    { method: 'DELETE' }
  )
}

// ─── Disk cleanup ─────────────────────────────────────────────────────────────

/**
 * Removes the task-specific uploads directory created during tests.
 * Safe to call even if the directory doesn't exist.
 */
export function cleanupTaskUploads(taskId: string): void {
  const dir = join(process.cwd(), 'data', 'uploads', taskId)
  rmSync(dir, { recursive: true, force: true })
}
