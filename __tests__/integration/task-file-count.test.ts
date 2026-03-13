/**
 * Integration tests — task.fileCount derived field
 *
 * Verifies that fileCount is correctly computed and included on Task objects
 * returned by DB repo functions and the REST API endpoint, eliminating the
 * need for per-card GET /api/tasks/[id]/files requests on board load.
 *
 * Uses a real (temp) SQLite database. No disk I/O — file records are inserted
 * directly via addTaskFile() without touching the file system.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/projects/[id]/tasks/route'
import {
  addProject,
  addTask,
  addTaskFile,
  deleteTaskFile,
  getTask,
  getAllTasks,
  getTasksByProject,
  getFilesByTask,
} from '@/lib/store'
import {
  makeTestProject,
  makeTestTask,
  makeTaskFileRecord,
} from '../helpers/test-utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function tasksRequest(projectId: string) {
  return new NextRequest(`http://localhost/api/projects/${projectId}/tasks`)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('task.fileCount — DB repo functions', () => {
  const project = makeTestProject()
  const taskNoFiles = makeTestTask(project.id, { title: 'No files' })
  const taskOneFile = makeTestTask(project.id, { title: 'One file' })
  const taskManyFiles = makeTestTask(project.id, { title: 'Many files' })

  beforeAll(() => {
    addProject(project)
    addTask(taskNoFiles)
    addTask(taskOneFile)
    addTask(taskManyFiles)

    // Attach 1 file to taskOneFile
    addTaskFile(makeTaskFileRecord(taskOneFile.id, 'a.txt'))

    // Attach 3 files to taskManyFiles
    addTaskFile(makeTaskFileRecord(taskManyFiles.id, 'b1.txt'))
    addTaskFile(makeTaskFileRecord(taskManyFiles.id, 'b2.txt'))
    addTaskFile(makeTaskFileRecord(taskManyFiles.id, 'b3.txt'))
  })

  it('getTask() returns fileCount 0 when no files are attached', () => {
    const task = getTask(taskNoFiles.id)
    expect(task).toBeDefined()
    expect(task!.fileCount).toBe(0)
  })

  it('getTask() returns fileCount 1 after one file is attached', () => {
    const task = getTask(taskOneFile.id)
    expect(task).toBeDefined()
    expect(task!.fileCount).toBe(1)
  })

  it('getTask() returns fileCount 3 after three files are attached', () => {
    const task = getTask(taskManyFiles.id)
    expect(task).toBeDefined()
    expect(task!.fileCount).toBe(3)
  })

  it('getTasksByProject() returns correct fileCount for each task', () => {
    const tasks = getTasksByProject(project.id)
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]))

    expect(byId[taskNoFiles.id].fileCount).toBe(0)
    expect(byId[taskOneFile.id].fileCount).toBe(1)
    expect(byId[taskManyFiles.id].fileCount).toBe(3)
  })

  it('getAllTasks() includes fileCount for every task', () => {
    const tasks = getAllTasks()
    // All returned tasks should have fileCount defined (not undefined)
    for (const t of tasks) {
      expect(typeof t.fileCount).toBe('number')
    }
  })
})

describe('task.fileCount — updates after mutations', () => {
  const project = makeTestProject()
  const task = makeTestTask(project.id, { title: 'Mutating files' })

  beforeAll(() => {
    addProject(project)
    addTask(task)
  })

  it('starts at 0', () => {
    expect(getTask(task.id)!.fileCount).toBe(0)
  })

  it('increments to 1 after addTaskFile()', () => {
    addTaskFile(makeTaskFileRecord(task.id, 'added.txt'))
    expect(getTask(task.id)!.fileCount).toBe(1)
  })

  it('increments to 2 after a second addTaskFile()', () => {
    addTaskFile(makeTaskFileRecord(task.id, 'added2.txt'))
    expect(getTask(task.id)!.fileCount).toBe(2)
  })

  it('decrements to 1 after deleteTaskFile()', () => {
    const files = getFilesByTask(task.id)
    expect(files).toHaveLength(2)
    deleteTaskFile(files[0].id)
    expect(getTask(task.id)!.fileCount).toBe(1)
  })
})

describe('task.fileCount — REST API endpoint', () => {
  const project = makeTestProject()
  const taskA = makeTestTask(project.id, { title: 'API task A' })
  const taskB = makeTestTask(project.id, { title: 'API task B' })

  beforeAll(() => {
    addProject(project)
    addTask(taskA)
    addTask(taskB)

    addTaskFile(makeTaskFileRecord(taskA.id, 'api-file-1.txt'))
    addTaskFile(makeTaskFileRecord(taskA.id, 'api-file-2.txt'))
    // taskB has no files
  })

  it('GET /api/projects/[id]/tasks includes fileCount on each task', async () => {
    const res = await GET(tasksRequest(project.id), params(project.id))
    expect(res.status).toBe(200)
    const tasks = await res.json()

    const a = tasks.find((t: { id: string }) => t.id === taskA.id)
    const b = tasks.find((t: { id: string }) => t.id === taskB.id)

    expect(a).toBeDefined()
    expect(b).toBeDefined()
    expect(a.fileCount).toBe(2)
    expect(b.fileCount).toBe(0)
  })
})
