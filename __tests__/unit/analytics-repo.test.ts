/**
 * Unit tests for dbGetProjectAnalytics() in lib/db/repositories/analyticsRepo.ts
 *
 * Each test seeds its own isolated project so assertions are never
 * contaminated by sibling tests.  DB isolation is handled automatically by
 * vitest's worker setup (unique temp SQLite per file via setup.ts).
 *
 * Timezone note:
 *   getDayKey() uses toISOString() — always UTC, fully deterministic.
 *   getMondayKey() delegates to getMondayEpoch() which uses UTC methods, so
 *   results are timezone-deterministic. We still use noon-UTC timestamps to
 *   be comfortably inside a single day in any timezone.
 *   We never assert string date labels because shortDateLabel() is
 *   locale+timezone dependent; we only assert numeric values and lengths.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { dbGetProjectAnalytics } from '@/lib/db/repositories/analyticsRepo'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { addProject } from '@/lib/store'
import { makeTestProject, makeTestTaskRun } from '../helpers/test-utils'

// ─── Fixed timestamps (noon UTC — safe across all timezones) ─────────────────

/** Monday 2026-03-09 noon UTC */
const D1 = new Date('2026-03-09T12:00:00Z').getTime()
/** Tuesday 2026-03-10 noon UTC (same week as D1) */
const D2 = new Date('2026-03-10T12:00:00Z').getTime()
/** Monday 2026-03-16 noon UTC (next week) */
const D3 = new Date('2026-03-16T12:00:00Z').getTime()
/** Tuesday 2026-03-17 noon UTC (same week as D3) */
const D4 = new Date('2026-03-17T12:00:00Z').getTime()

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Seed a run directly into the DB and return it. */
function seedRun(projectId: string, overrides: Parameters<typeof makeTestTaskRun>[1] = {}) {
  const run = makeTestTaskRun(projectId, overrides)
  dbAddTaskRun(run)
  return run
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('dbGetProjectAnalytics', () => {
  // ── 1. Empty project ───────────────────────────────────────────────────────

  describe('empty project (no runs)', () => {
    let projectId: string

    beforeAll(() => {
      const project = makeTestProject()
      addProject(project)
      projectId = project.id
    })

    it('returns all summary fields as 0', () => {
      const { summary } = dbGetProjectAnalytics(projectId)
      expect(summary.totalRunsDone).toBe(0)
      expect(summary.totalRunsFailed).toBe(0)
      expect(summary.totalCostUsd).toBe(0)
      expect(summary.totalInputTokens).toBe(0)
      expect(summary.totalOutputTokens).toBe(0)
      expect(summary.avgCostPerRun).toBe(0)
    })

    it('returns empty arrays for all chart datasets', () => {
      const { weeklyTasks, dailyTokens, dailyCost, costByRole } = dbGetProjectAnalytics(projectId)
      expect(weeklyTasks).toEqual([])
      expect(dailyTokens).toEqual([])
      expect(dailyCost).toEqual([])
      expect(costByRole).toEqual([])
    })
  })

  // ── 2. Single done run ─────────────────────────────────────────────────────

  it('counts a single done run correctly', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done', costUsd: 0.05, completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalRunsDone).toBe(1)
    expect(summary.totalRunsFailed).toBe(0)
    expect(summary.avgCostPerRun).toBeCloseTo(0.05)
  })

  // ── 3. Single failed run ───────────────────────────────────────────────────

  it('guards avgCostPerRun division when totalRunsDone is 0', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'failed', costUsd: 0.02, completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalRunsDone).toBe(0)
    expect(summary.totalRunsFailed).toBe(1)
    expect(summary.avgCostPerRun).toBe(0)
  })

  // ── 4. Mixed statuses ─────────────────────────────────────────────────────

  it('counts done and failed runs independently', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done', completedAt: D1 })
    seedRun(project.id, { status: 'done', completedAt: D1 })
    seedRun(project.id, { status: 'done', completedAt: D1 })
    seedRun(project.id, { status: 'failed', completedAt: D1 })
    seedRun(project.id, { status: 'failed', completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalRunsDone).toBe(3)
    expect(summary.totalRunsFailed).toBe(2)
  })

  // ── 5. Token and cost summation ────────────────────────────────────────────

  it('sums tokens and costs across multiple runs', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { inputTokens: 1_000, outputTokens: 500, costUsd: 0.01, completedAt: D1 })
    seedRun(project.id, { inputTokens: 2_000, outputTokens: 800, costUsd: 0.02, completedAt: D1 })
    seedRun(project.id, { inputTokens:   500, outputTokens: 200, costUsd: 0.005, completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalInputTokens).toBe(3_500)
    expect(summary.totalOutputTokens).toBe(1_500)
    expect(summary.totalCostUsd).toBeCloseTo(0.035)
    expect(Number.isNaN(summary.totalCostUsd)).toBe(false)
  })

  // ── 6. Null token/cost fields ──────────────────────────────────────────────

  it('treats null inputTokens / outputTokens / costUsd as 0', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, {
      inputTokens:  undefined,
      outputTokens: undefined,
      costUsd:      undefined,
      completedAt:  D1,
    })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalInputTokens).toBe(0)
    expect(summary.totalOutputTokens).toBe(0)
    expect(summary.totalCostUsd).toBe(0)
    expect(Number.isNaN(summary.totalCostUsd)).toBe(false)
  })

  // ── 7. Weekly grouping — same week ────────────────────────────────────────

  it('groups two runs in the same week into one weekly bucket', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done', completedAt: D1 }) // Mon
    seedRun(project.id, { status: 'done', completedAt: D2 }) // Tue (same week)

    const { weeklyTasks } = dbGetProjectAnalytics(project.id)
    expect(weeklyTasks).toHaveLength(1)
    expect(weeklyTasks[0].done).toBe(2)
    expect(weeklyTasks[0].failed).toBe(0)
  })

  // ── 8. Weekly grouping — different weeks ──────────────────────────────────

  it('groups runs in different weeks into separate buckets sorted chronologically', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done',   completedAt: D1 }) // week 1 Mon
    seedRun(project.id, { status: 'failed', completedAt: D3 }) // week 2 Mon

    const { weeklyTasks } = dbGetProjectAnalytics(project.id)
    expect(weeklyTasks).toHaveLength(2)
    // Sorted chronologically (week 1 first)
    expect(weeklyTasks[0].done).toBe(1)
    expect(weeklyTasks[0].failed).toBe(0)
    expect(weeklyTasks[1].done).toBe(0)
    expect(weeklyTasks[1].failed).toBe(1)
  })

  // ── 9. Daily token grouping — same UTC day ────────────────────────────────

  it('merges two runs on the same UTC day into one daily token bucket', () => {
    const project = makeTestProject()
    addProject(project)
    // D1 and D1+1h are the same UTC day
    seedRun(project.id, { inputTokens: 1_000, outputTokens: 400, completedAt: D1 })
    seedRun(project.id, { inputTokens:   500, outputTokens: 200, completedAt: D1 + 3_600_000 })

    const { dailyTokens } = dbGetProjectAnalytics(project.id)
    expect(dailyTokens).toHaveLength(1)
    expect(dailyTokens[0].inputTokens).toBe(1_500)
    expect(dailyTokens[0].outputTokens).toBe(600)
  })

  // ── 10. Daily token grouping — different days ─────────────────────────────

  it('creates separate daily token buckets for different UTC days, sorted chronologically', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { inputTokens: 1_000, outputTokens: 400, completedAt: D1 })
    seedRun(project.id, { inputTokens:   500, outputTokens: 200, completedAt: D2 })

    const { dailyTokens } = dbGetProjectAnalytics(project.id)
    expect(dailyTokens).toHaveLength(2)
    // D1 (Mon) before D2 (Tue)
    expect(dailyTokens[0].inputTokens).toBe(1_000)
    expect(dailyTokens[1].inputTokens).toBe(500)
  })

  // ── 11. Cumulative cost ────────────────────────────────────────────────────

  it('produces a monotonically increasing cumulativeCost across days', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { costUsd: 0.01, completedAt: D1 })
    seedRun(project.id, { costUsd: 0.02, completedAt: D2 })
    seedRun(project.id, { costUsd: 0.03, completedAt: D3 })

    const { dailyCost } = dbGetProjectAnalytics(project.id)
    expect(dailyCost).toHaveLength(3)

    // Each entry must be >= the previous (monotonic)
    for (let i = 1; i < dailyCost.length; i++) {
      expect(dailyCost[i].cumulativeCost).toBeGreaterThanOrEqual(dailyCost[i - 1].cumulativeCost)
    }

    // Final value equals total cost
    expect(dailyCost[dailyCost.length - 1].cumulativeCost).toBeCloseTo(0.06)
  })

  // ── 12. Cost by role — sorted descending ──────────────────────────────────

  it('sorts costByRole by total cost descending', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { role: 'coder',        costUsd: 0.03, completedAt: D1 })
    seedRun(project.id, { role: 'researcher',   costUsd: 0.01, completedAt: D1 })
    seedRun(project.id, { role: 'senior-coder', costUsd: 0.02, completedAt: D1 })

    const { costByRole } = dbGetProjectAnalytics(project.id)
    expect(costByRole).toHaveLength(3)
    expect(costByRole[0].role).toBe('coder')
    expect(costByRole[1].role).toBe('senior-coder')
    expect(costByRole[2].role).toBe('researcher')

    // Values must also be sorted descending
    for (let i = 1; i < costByRole.length; i++) {
      expect(costByRole[i].totalCost).toBeLessThanOrEqual(costByRole[i - 1].totalCost)
    }
  })

  // ── 13. Date range — from only ────────────────────────────────────────────

  it('excludes runs before `from` when a from filter is supplied', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done', completedAt: D1 }) // excluded
    seedRun(project.id, { status: 'done', completedAt: D2 }) // included
    seedRun(project.id, { status: 'done', completedAt: D3 }) // included

    const { summary } = dbGetProjectAnalytics(project.id, D2)
    expect(summary.totalRunsDone).toBe(2)
  })

  // ── 14. Date range — from + to ────────────────────────────────────────────

  it('includes only runs within [from, to] when both are supplied', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done', completedAt: D1 }) // excluded (before from)
    seedRun(project.id, { status: 'done', completedAt: D2 }) // included
    seedRun(project.id, { status: 'done', completedAt: D3 }) // excluded (after to)

    const { summary } = dbGetProjectAnalytics(project.id, D2, D2)
    expect(summary.totalRunsDone).toBe(1)
  })

  // ── 15. Project isolation ─────────────────────────────────────────────────

  it('only includes runs belonging to the requested project', () => {
    const projectA = makeTestProject()
    const projectB = makeTestProject()
    addProject(projectA)
    addProject(projectB)

    seedRun(projectA.id, { costUsd: 0.10, completedAt: D1 })
    seedRun(projectA.id, { costUsd: 0.10, completedAt: D1 })
    seedRun(projectB.id, { costUsd: 0.99, completedAt: D1 }) // must NOT appear in A's analytics

    const { summary } = dbGetProjectAnalytics(projectA.id)
    expect(summary.totalRunsDone).toBe(2)
    expect(summary.totalCostUsd).toBeCloseTo(0.20)
  })
})

// --- Status classification ---------------------------------------------------

describe('status classification', () => {
  it.each([
    { status: 'done' as const,   expectDone: 1, expectFailed: 0 },
    { status: 'failed' as const, expectDone: 0, expectFailed: 1 },
  ])('correctly classifies status=$status', async ({ status, expectDone, expectFailed }) => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status, completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalRunsDone).toBe(expectDone)
    expect(summary.totalRunsFailed).toBe(expectFailed)
    // Neither category should contain extra counts
    expect(summary.totalRunsDone + summary.totalRunsFailed).toBe(1)
  })

  it('does not double-count - done increments only totalRunsDone', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done', completedAt: D1 })
    seedRun(project.id, { status: 'done', completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalRunsDone).toBe(2)
    expect(summary.totalRunsFailed).toBe(0)
  })

  it('does not double-count - failed increments only totalRunsFailed', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'failed', completedAt: D1 })
    seedRun(project.id, { status: 'failed', completedAt: D1 })

    const { summary } = dbGetProjectAnalytics(project.id)
    expect(summary.totalRunsDone).toBe(0)
    expect(summary.totalRunsFailed).toBe(2)
  })

  it('weekly bucket classifies done vs failed explicitly', () => {
    const project = makeTestProject()
    addProject(project)
    seedRun(project.id, { status: 'done',   completedAt: D1 })
    seedRun(project.id, { status: 'failed', completedAt: D1 })

    const { weeklyTasks } = dbGetProjectAnalytics(project.id)
    expect(weeklyTasks).toHaveLength(1)
    expect(weeklyTasks[0].done).toBe(1)
    expect(weeklyTasks[0].failed).toBe(1)
  })
})
