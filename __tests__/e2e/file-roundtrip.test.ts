/**
 * End-to-end round-trip test — full file attachment lifecycle
 *
 * This test exercises the complete workflow in sequence using the real
 * route handlers, real SQLite (temp file), and real disk I/O:
 *
 *   1. Create a project + task
 *   2. Upload test-image.png  → assert 201, record in DB
 *   3. List files for task    → assert 1 file
 *   4. Download the file      → assert bytes match original fixture
 *   5. Delete the file        → assert 204
 *   6. List files again       → assert empty array
 *   7. Verify disk file gone
 *
 * This test is intentionally written as a single `it` with sequential steps
 * so that any failure immediately reveals which step broke.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { existsSync } from 'fs'
import { join } from 'path'
import { NextRequest } from 'next/server'
import { GET as listFiles, POST as uploadFile } from '@/app/api/tasks/[id]/files/route'
import { GET as downloadFile } from '@/app/api/files/[id]/content/route'
import { DELETE as deleteFile } from '@/app/api/tasks/[id]/files/[fileId]/route'
import { addProject, addTask } from '@/lib/store'
import {
  makeTestProject,
  makeTestTask,
  createUploadRequest,
  fixtureBuffer,
  cleanupTaskUploads,
} from '../helpers/test-utils'

// ─── Shared state set during the round-trip ───────────────────────────────────

let roundtripTaskId: string

afterAll(() => {
  if (roundtripTaskId) cleanupTaskUploads(roundtripTaskId)
})

// ─── Round-trip test ──────────────────────────────────────────────────────────

describe('File lifecycle — full round-trip', () => {
  it('upload → list → download → delete → verify gone', async () => {
    // ── Step 1: Create project and task ─────────────────────────────────────
    const project = makeTestProject({ name: 'E2E Round-trip Project' })
    addProject(project)

    const task = makeTestTask(project.id, { title: 'E2E Round-trip Task' })
    addTask(task)
    roundtripTaskId = task.id

    const taskParams = (id = task.id) => ({ params: Promise.resolve({ id }) })

    // ── Step 2: Upload test-image.png ────────────────────────────────────────
    const originalBytes = fixtureBuffer('test-image.png')
    const uploadReq = createUploadRequest(task.id, [
      { name: 'test-image.png', type: 'image/png', content: originalBytes },
    ])

    const uploadRes = await uploadFile(uploadReq, taskParams())
    expect(uploadRes.status, 'upload should return 201').toBe(201)

    const uploadBody = await uploadRes.json()
    expect(uploadBody.saved, 'should have one saved record').toHaveLength(1)

    const fileRecord = uploadBody.saved[0]
    expect(fileRecord.taskId).toBe(task.id)
    expect(fileRecord.mimeType).toBe('image/png')

    // ── Step 3: List files — expect exactly one attachment ───────────────────
    const listRes1 = await listFiles(
      new NextRequest(`http://localhost/api/tasks/${task.id}/files`),
      taskParams()
    )
    expect(listRes1.status, 'list should return 200').toBe(200)

    const listBody1 = await listRes1.json()
    expect(listBody1, 'should list one file').toHaveLength(1)
    expect(listBody1[0].id).toBe(fileRecord.id)

    // ── Step 4: Download the file — bytes must match original ────────────────
    const downloadReq = new NextRequest(
      `http://localhost/api/files/${fileRecord.id}/content`
    )
    const downloadRes = await downloadFile(
      downloadReq,
      { params: Promise.resolve({ id: fileRecord.id }) }
    )
    expect(downloadRes.status, 'download should return 200').toBe(200)
    expect(downloadRes.headers.get('Content-Type')).toBe('image/png')
    expect(downloadRes.headers.get('Content-Disposition')).toMatch(/^inline;/)

    const downloadedBytes = Buffer.from(await downloadRes.arrayBuffer())
    expect(downloadedBytes.length, 'downloaded size must match original').toBe(originalBytes.length)
    expect(downloadedBytes, 'downloaded bytes must be bit-for-bit identical').toEqual(originalBytes)

    // ── Step 5: Delete the file ───────────────────────────────────────────────
    const deleteReq = new NextRequest(
      `http://localhost/api/tasks/${task.id}/files/${fileRecord.id}`,
      { method: 'DELETE' }
    )
    const deleteRes = await deleteFile(
      deleteReq,
      { params: Promise.resolve({ id: task.id, fileId: fileRecord.id }) }
    )
    expect(deleteRes.status, 'delete should return 204').toBe(204)

    // ── Step 6: List files again — expect empty array ────────────────────────
    const listRes2 = await listFiles(
      new NextRequest(`http://localhost/api/tasks/${task.id}/files`),
      taskParams()
    )
    expect(listRes2.status).toBe(200)

    const listBody2 = await listRes2.json()
    expect(listBody2, 'list should be empty after deletion').toHaveLength(0)

    // ── Step 7: Verify disk file is gone ─────────────────────────────────────
    const diskPath = join(process.cwd(), ...fileRecord.storagePath.split('/'))
    expect(existsSync(diskPath), 'file should be removed from disk').toBe(false)
  })
})

// ─── Error path round-trip ─────────────────────────────────────────────────

describe('File lifecycle — partial failure round-trip', () => {
  it('handles mixed valid/invalid files in one upload correctly', async () => {
    const project = makeTestProject()
    addProject(project)

    const task = makeTestTask(project.id)
    addTask(task)

    afterAll(() => cleanupTaskUploads(task.id))

    const png = fixtureBuffer('test-image.png')
    const evil = Buffer.from('malicious content')

    const uploadReq = createUploadRequest(task.id, [
      { name: 'good.png', type: 'image/png', content: png },
      { name: 'virus.exe', type: 'application/exe', content: evil },
    ])

    const uploadRes = await uploadFile(
      uploadReq,
      { params: Promise.resolve({ id: task.id }) }
    )

    // 201 because at least one file was saved
    expect(uploadRes.status).toBe(201)
    const body = await uploadRes.json()
    expect(body.saved).toHaveLength(1)
    expect(body.errors).toHaveLength(1)
    expect(body.saved[0].filename).toBe('good.png')
    expect(body.errors[0].filename).toBe('virus.exe')

    // Only one file listed for the task
    const listRes = await listFiles(
      new NextRequest(`http://localhost/api/tasks/${task.id}/files`),
      { params: Promise.resolve({ id: task.id }) }
    )
    const files = await listRes.json()
    expect(files).toHaveLength(1)
  })
})
