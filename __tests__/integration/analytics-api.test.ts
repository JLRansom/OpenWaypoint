/**
 * Integration tests — GET /api/projects/[id]/analytics
 *
 * Calls the route handler directly with synthetic NextRequest objects.
 * Uses a real (temp) SQLite database so the full aggregation pipeline is
 * exercised without a running server.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/projects/[id]/analytics/route'
import { addProject } from '@/lib/store'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { makeTestProject, makeTestTaskRun } from '../helpers/test-utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a params object matching Next.js App Router conventions. */
function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

/** Builds a NextRequest for the analytics endpoint with optional query params. */
function analyticsRequest(projectId: string, query: Record<string, string> = {}) {
  const url = new URL(`http://localhost/api/projects/${projectId}/analytics`)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

// Fixed timestamps (noon UTC — safe in all timezones)
const D1 = new Date('2026-03-09T12:00:00Z').getTime() // Mon
const D2 = new Date('2026-03-10T12:00:00Z').getTime() // Tue
const D3 = new Date('2026-03-16T12:00:00Z').getTime() // Mon +1w

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/projects/[id]/analytics', () => {
  // ── 1. Unknown project ────────────────────────────────────────────────────

  it('returns 404 for a non-existent project', async () => {
    const req = analyticsRequest('does-not-exist')
    const res = await GET(req, params('does-not-exist'))

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toMatchObject({ error: 'not found' })
  })

  // ── 2. Project with no runs ────────────────────────────────────────────────

  it('returns 200 with all zeros and empty arrays when no runs exist', async () => {
    const project = makeTestProject()
    addProject(project)

    const req = analyticsRequest(project.id)
    const res = await GET(req, params(project.id))

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.totalRunsDone).toBe(0)
    expect(body.summary.totalRunsFailed).toBe(0)
    expect(body.summary.totalCostUsd).toBe(0)
    expect(body.summary.avgCostPerRun).toBe(0)
    expect(body.weeklyTasks).toEqual([])
    expect(body.dailyTokens).toEqual([])
    expect(body.dailyCost).toEqual([])
    expect(body.costByRole).toEqual([])
  })

  // ── 3. Project with runs ───────────────────────────────────────────────────

  it('returns 200 with correct aggregated data', async () => {
    const project = makeTestProject()
    addProject(project)

    const run1 = makeTestTaskRun(project.id, { status: 'done',   costUsd: 0.01, completedAt: D1 })
    const run2 = makeTestTaskRun(project.id, { status: 'failed', costUsd: 0.02, completedAt: D2 })
    dbAddTaskRun(run1)
    dbAddTaskRun(run2)

    const req = analyticsRequest(project.id)
    const res = await GET(req, params(project.id))

    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.summary.totalRunsDone).toBe(1)
    expect(body.summary.totalRunsFailed).toBe(1)
    expect(body.summary.totalCostUsd).toBeCloseTo(0.03)
    // avgCostPerRun = totalCostUsd / totalRunsDone = 0.03 / 1 = 0.03
    expect(body.summary.avgCostPerRun).toBeCloseTo(0.03)
  })

  // ── 4. Date range filtering via query params ───────────────────────────────

  it('applies from and to query params to filter runs', async () => {
    const project = makeTestProject()
    addProject(project)

    dbAddTaskRun(makeTestTaskRun(project.id, { status: 'done', completedAt: D1 })) // excluded
    dbAddTaskRun(makeTestTaskRun(project.id, { status: 'done', completedAt: D2 })) // included
    dbAddTaskRun(makeTestTaskRun(project.id, { status: 'done', completedAt: D3 })) // excluded

    const req = analyticsRequest(project.id, {
      from: String(D2),
      to:   String(D2),
    })
    const res = await GET(req, params(project.id))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.totalRunsDone).toBe(1)
  })

  // ── 5. Non-numeric query params handled gracefully ─────────────────────────

  it('ignores non-numeric from/to params and returns all runs', async () => {
    const project = makeTestProject()
    addProject(project)

    dbAddTaskRun(makeTestTaskRun(project.id, { status: 'done', completedAt: D1 }))
    dbAddTaskRun(makeTestTaskRun(project.id, { status: 'done', completedAt: D2 }))

    // parseInt('abc') === NaN — the route passes it as `from` which is NaN.
    // The repo receives NaN for from/to; gte/lte with NaN effectively filter nothing.
    const req = analyticsRequest(project.id, { from: 'abc', to: 'xyz' })
    const res = await GET(req, params(project.id))

    expect(res.status).toBe(200)
    const body = await res.json()
    // All runs should be returned since the filter is effectively absent
    expect(body.summary.totalRunsDone).toBe(2)
  })
})
