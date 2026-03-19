/**
 * Unit tests for the two agent-scoped query functions in taskRunRepo:
 *   - dbGetTaskRunsByAgent(agentId)
 *   - dbGetRecentTaskRunsByAgent(agentId, since)
 *
 * Each describe block seeds its own isolated data so there is no
 * cross-test contamination.  DB isolation is provided by the per-worker
 * temp SQLite setup in __tests__/helpers/setup.ts.
 *
 * Timestamp note: we use fixed noon-UTC dates for determinism.
 * `completedAt` is what the `since` filter is applied against.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import {
  dbAddTaskRun,
  dbGetTaskRunsByAgent,
  dbGetRecentTaskRunsByAgent,
} from '@/lib/db/repositories/taskRunRepo'
import { addProject } from '@/lib/store'
import { makeTestProject, makeTestTaskRun } from '../helpers/test-utils'
import type { TaskRun } from '@/lib/types'

// ─── Fixed timestamps ─────────────────────────────────────────────────────────

/** 2026-03-09 noon UTC */
const T1 = new Date('2026-03-09T12:00:00Z').getTime()
/** 2026-03-10 noon UTC (+1 day) */
const T2 = new Date('2026-03-10T12:00:00Z').getTime()
/** 2026-03-11 noon UTC (+2 days) */
const T3 = new Date('2026-03-11T12:00:00Z').getTime()
/** 2026-03-16 noon UTC (+7 days) */
const T4 = new Date('2026-03-16T12:00:00Z').getTime()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedRun(
  projectId: string,
  agentId: string,
  overrides: Partial<TaskRun> = {},
): TaskRun {
  const run = makeTestTaskRun(projectId, { agentId, ...overrides })
  dbAddTaskRun(run)
  return run
}

// ─── dbGetTaskRunsByAgent ─────────────────────────────────────────────────────

describe('dbGetTaskRunsByAgent', () => {
  let projectId: string
  let agentA: string
  let agentB: string

  beforeAll(() => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id
    agentA = randomUUID()
    agentB = randomUUID()

    // Seed 3 runs for agentA and 1 for agentB
    seedRun(projectId, agentA, { completedAt: T1 })
    seedRun(projectId, agentA, { completedAt: T2 })
    seedRun(projectId, agentA, { completedAt: T3 })
    seedRun(projectId, agentB, { completedAt: T1 })
  })

  it('returns all runs belonging to the requested agent', () => {
    const runs = dbGetTaskRunsByAgent(agentA)
    expect(runs).toHaveLength(3)
    for (const r of runs) {
      expect(r.agentId).toBe(agentA)
    }
  })

  it('returns an empty array for an unknown agent ID', () => {
    const runs = dbGetTaskRunsByAgent(randomUUID())
    expect(runs).toEqual([])
  })

  it('does not include runs belonging to a different agent', () => {
    const runs = dbGetTaskRunsByAgent(agentA)
    const ids = runs.map((r) => r.agentId)
    expect(ids).not.toContain(agentB)
  })

  it('returns runs ordered by completedAt DESC (newest first)', () => {
    const runs = dbGetTaskRunsByAgent(agentA)
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i - 1].completedAt).toBeGreaterThanOrEqual(runs[i].completedAt)
    }
  })

  it('each returned run has the expected TaskRun shape', () => {
    const [run] = dbGetTaskRunsByAgent(agentA)
    expect(typeof run.id).toBe('string')
    expect(typeof run.taskId).toBe('string')
    expect(typeof run.projectId).toBe('string')
    expect(typeof run.agentId).toBe('string')
    expect(typeof run.role).toBe('string')
    expect(typeof run.status).toBe('string')
    expect(typeof run.startedAt).toBe('number')
    expect(typeof run.completedAt).toBe('number')
    // totalTokens is computed (inputTokens + outputTokens) — must be a number when both are present
    if (run.inputTokens != null && run.outputTokens != null) {
      expect(run.totalTokens).toBe(run.inputTokens + run.outputTokens)
    }
  })
})

// ─── dbGetRecentTaskRunsByAgent ───────────────────────────────────────────────

describe('dbGetRecentTaskRunsByAgent', () => {
  let projectId: string
  let agentId: string

  beforeAll(() => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id
    agentId = randomUUID()

    // Spread across time: T1, T2, T3, T4
    seedRun(projectId, agentId, { completedAt: T1 })
    seedRun(projectId, agentId, { completedAt: T2 })
    seedRun(projectId, agentId, { completedAt: T3 })
    seedRun(projectId, agentId, { completedAt: T4 })
  })

  it('returns runs with completedAt >= since', () => {
    const runs = dbGetRecentTaskRunsByAgent(agentId, T3)
    // T3 and T4 are >= T3; T1 and T2 are excluded
    expect(runs).toHaveLength(2)
    for (const r of runs) {
      expect(r.completedAt).toBeGreaterThanOrEqual(T3)
    }
  })

  it('excludes runs completed strictly before `since`', () => {
    const runs = dbGetRecentTaskRunsByAgent(agentId, T3)
    const times = runs.map((r) => r.completedAt)
    expect(times).not.toContain(T1)
    expect(times).not.toContain(T2)
  })

  it('returns all runs when `since` is set to a very early timestamp', () => {
    const runs = dbGetRecentTaskRunsByAgent(agentId, 0)
    expect(runs).toHaveLength(4)
  })

  it('returns an empty array when no runs fall within the `since` window', () => {
    // since is set to a future date beyond all seeded runs
    const future = T4 + 86_400_000
    const runs = dbGetRecentTaskRunsByAgent(agentId, future)
    expect(runs).toEqual([])
  })

  it('returns empty array for an unknown agentId', () => {
    const runs = dbGetRecentTaskRunsByAgent(randomUUID(), T1)
    expect(runs).toEqual([])
  })

  it('boundary: includes the run exactly at `since`', () => {
    // T2 is the exact boundary value
    const runs = dbGetRecentTaskRunsByAgent(agentId, T2)
    const times = runs.map((r) => r.completedAt)
    expect(times).toContain(T2)
  })

  it('returns runs for a different agent ID without cross-contamination', () => {
    const otherAgent = randomUUID()
    // otherAgent has no seeded runs
    const runs = dbGetRecentTaskRunsByAgent(otherAgent, T1)
    expect(runs).toEqual([])
  })
})
