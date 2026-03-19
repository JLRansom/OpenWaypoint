/**
 * Unit tests for lib/health-baselines.ts and the applyRoleBaseline() function
 * exported from lib/health.ts.
 *
 * Tests are grouped into four areas:
 *  1. medianOf() helper
 *  2. computeRoleBaseline() — computation logic and degradation ladder
 *  3. getRoleBaseline() — cache TTL and invalidation
 *  4. applyRoleBaseline() — normalisation rules and guards
 *
 * Uses a real isolated SQLite DB (via setup.ts) so that computeRoleBaseline
 * exercises the full DB→compute path rather than mocking internals.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { randomUUID } from 'crypto'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { makeTestTaskRun } from '../helpers/test-utils'
import {
  computeRoleBaseline,
  getRoleBaseline,
  invalidateRoleBaselines,
  medianOf,
  MIN_COHORT_SIZE,
  BASELINE_TTL_MS,
  BASELINE_WINDOW_MS,
} from '@/lib/health-baselines'
import {
  applyRoleBaseline,
  MIN_COHORT_SIZE_FOR_BASELINE,
} from '@/lib/health'
import type { AgentHealthMetrics } from '@/lib/types'

// ---------------------------------------------------------------------------
// Fixed reference time
// ---------------------------------------------------------------------------

/** Wednesday 2026-03-11 noon UTC — same anchor used in health.test.ts */
const NOW = new Date('2026-03-11T12:00:00Z').getTime()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seeds `count` task runs for the given agentId and role inside the 7-day
 * rolling window that `computeHealthMetrics` uses, spaced 30 minutes apart.
 *
 * Runs are placed within the last 24 hours so they safely fall inside the
 * rolling window regardless of which NOW anchor is used.  All `count` runs
 * will therefore contribute to `hasEnoughData` and the per-agent metrics
 * that `computeRoleBaseline` collects.
 */
function seedRunsForAgent(
  agentId: string,
  role: string,
  count: number,
  status: 'done' | 'failed' = 'done',
  now: number = NOW,
): void {
  for (let i = 0; i < count; i++) {
    // Space 30 min apart, most recent first, all within last 24 h
    const completedAt = now - (i + 1) * 30 * 60_000
    dbAddTaskRun(
      makeTestTaskRun(randomUUID(), {
        agentId,
        role,
        status,
        completedAt,
        startedAt: completedAt - 30_000,
      }),
    )
  }
}

// ---------------------------------------------------------------------------
// 1. medianOf()
// ---------------------------------------------------------------------------

describe('medianOf', () => {
  it('returns null for an empty array', () => {
    expect(medianOf([])).toBeNull()
  })

  it('returns the single value for a one-element array', () => {
    expect(medianOf([42])).toBe(42)
  })

  it('returns the middle value for an odd-length array', () => {
    expect(medianOf([3, 1, 4, 1, 5])).toBe(3) // sorted: [1,1,3,4,5]
  })

  it('returns the average of the two middle values for an even-length array', () => {
    expect(medianOf([1, 3, 5, 7])).toBe(4) // (3+5)/2
  })

  it('does not mutate the input array', () => {
    const input = [5, 2, 8, 1]
    medianOf(input)
    expect(input).toEqual([5, 2, 8, 1])
  })
})

// ---------------------------------------------------------------------------
// 2. computeRoleBaseline()
// ---------------------------------------------------------------------------

describe('computeRoleBaseline', () => {
  beforeEach(() => {
    invalidateRoleBaselines()
  })

  it('returns null-metric baseline with cohortSize=0 when no runs exist for the role', () => {
    const result = computeRoleBaseline('tester', NOW)
    expect(result.cohortSize).toBe(0)
    expect(result.medianCompletionRate).toBeNull()
    expect(result.medianErrorDensity).toBeNull()
    expect(result.medianWeeklyThroughput).toBeNull()
    expect(result.role).toBe('tester')
    expect(result.computedAt).toBe(NOW)
  })

  it('returns null-metric baseline when cohort has fewer than MIN_COHORT_SIZE qualifying agents', () => {
    // Seed 2 agents with enough runs — below the MIN_COHORT_SIZE of 3
    for (let i = 0; i < MIN_COHORT_SIZE - 1; i++) {
      seedRunsForAgent(randomUUID(), 'writer', 6, 'done', NOW)
    }
    const result = computeRoleBaseline('writer', NOW)
    expect(result.cohortSize).toBeLessThan(MIN_COHORT_SIZE)
    expect(result.medianCompletionRate).toBeNull()
    expect(result.medianErrorDensity).toBeNull()
  })

  it('returns meaningful baselines when cohort meets MIN_COHORT_SIZE', () => {
    // Seed 3 agents, each with 6 done runs → completion rate = 1, error density = 0
    for (let i = 0; i < MIN_COHORT_SIZE; i++) {
      seedRunsForAgent(randomUUID(), 'researcher', 6, 'done', NOW)
    }
    const result = computeRoleBaseline('researcher', NOW)
    expect(result.cohortSize).toBe(MIN_COHORT_SIZE)
    expect(result.medianCompletionRate).toBe(1)
    expect(result.medianErrorDensity).toBe(0)
    expect(result.medianWeeklyThroughput).not.toBeNull()
    expect(result.medianWeeklyThroughput!).toBeGreaterThan(0)
  })

  it('only counts agents with >= MIN_RUNS_THRESHOLD runs as qualifying', () => {
    // 2 agents with enough runs + 1 with too few — only 2 qualify, below cohort min
    seedRunsForAgent(randomUUID(), 'coder', 6, 'done', NOW)
    seedRunsForAgent(randomUUID(), 'coder', 6, 'done', NOW)
    seedRunsForAgent(randomUUID(), 'coder', 2, 'done', NOW) // sparse — not qualifying
    const result = computeRoleBaseline('coder', NOW)
    expect(result.cohortSize).toBe(2) // only 2 qualify
    expect(result.medianCompletionRate).toBeNull()  // below MIN_COHORT_SIZE
  })

  it('excludes runs outside the 30-day window when determining qualifying agents', () => {
    const agentId = randomUUID()
    // Seed 6 runs but all 36 days ago — outside BASELINE_WINDOW_MS
    const ancient = NOW - BASELINE_WINDOW_MS - 36 * 24 * 3600_000
    for (let i = 0; i < 6; i++) {
      dbAddTaskRun(
        makeTestTaskRun(randomUUID(), {
          agentId,
          role: 'senior-coder',
          status: 'done',
          completedAt: ancient + i * 60_000,
          startedAt: ancient + i * 60_000 - 30_000,
        }),
      )
    }
    // No other agents → cohort = 0
    const result = computeRoleBaseline('senior-coder', NOW)
    expect(result.cohortSize).toBe(0)
  })

  it('computes correct median completionRate across a mixed cohort', () => {
    // 3 agents: rates ~1.0, ~0.5, ~0.0 → median = 0.5
    const agents = [randomUUID(), randomUUID(), randomUUID()]
    // Agent 0: all done → rate 1.0
    seedRunsForAgent(agents[0], 'tester', 6, 'done', NOW)
    // Agent 1: half done, half failed → rate 0.5
    seedRunsForAgent(agents[1], 'tester', 3, 'done', NOW)
    seedRunsForAgent(agents[1], 'tester', 3, 'failed', NOW)
    // Agent 2: all failed → rate 0.0
    seedRunsForAgent(agents[2], 'tester', 6, 'failed', NOW)

    const result = computeRoleBaseline('tester', NOW)
    expect(result.cohortSize).toBe(3)
    expect(result.medianCompletionRate).toBeCloseTo(0.5, 5)
    expect(result.medianErrorDensity).toBeCloseTo(0.5, 5)
  })

  it('returns cohortSize correctly even when below threshold', () => {
    // senior-coder is only seeded in the "excludes runs outside window" test above,
    // and those runs are outside BASELINE_WINDOW_MS — so they produce 0 qualifying agents.
    // Adding 1 agent with inside-window runs here means cohortSize = 1 (below MIN_COHORT_SIZE).
    seedRunsForAgent(randomUUID(), 'senior-coder', 6, 'done', NOW)
    const result = computeRoleBaseline('senior-coder', NOW)
    expect(result.cohortSize).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// 3. getRoleBaseline() — cache behaviour
// ---------------------------------------------------------------------------

describe('getRoleBaseline', () => {
  beforeEach(() => {
    invalidateRoleBaselines()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a baseline without throwing even for an empty role cohort', () => {
    const result = getRoleBaseline('researcher')
    expect(result).toBeDefined()
    expect(result.role).toBe('researcher')
  })

  it('returns cached baseline within TTL without recomputing', () => {
    // Seed enough data so a real baseline exists
    for (let i = 0; i < MIN_COHORT_SIZE; i++) {
      seedRunsForAgent(randomUUID(), 'coder', 6, 'done', NOW)
    }

    const first = getRoleBaseline('coder')
    // Advance time but stay within TTL
    vi.advanceTimersByTime(BASELINE_TTL_MS - 1_000)
    const second = getRoleBaseline('coder')
    // Same object reference means the cache was hit
    expect(second).toBe(first)
  })

  it('recomputes baseline after TTL expires', () => {
    for (let i = 0; i < MIN_COHORT_SIZE; i++) {
      seedRunsForAgent(randomUUID(), 'coder', 6, 'done', NOW)
    }

    const first = getRoleBaseline('coder')
    // Advance past TTL
    vi.advanceTimersByTime(BASELINE_TTL_MS + 1_000)
    const second = getRoleBaseline('coder')
    // Should be a fresh object (different reference)
    expect(second).not.toBe(first)
  })

  it('invalidateRoleBaselines() for a specific role forces recompute', () => {
    for (let i = 0; i < MIN_COHORT_SIZE; i++) {
      seedRunsForAgent(randomUUID(), 'writer', 6, 'done', NOW)
    }

    const first = getRoleBaseline('writer')
    invalidateRoleBaselines('writer')
    const second = getRoleBaseline('writer')
    expect(second).not.toBe(first)
  })

  it('invalidateRoleBaselines() without argument clears all roles', () => {
    for (let i = 0; i < MIN_COHORT_SIZE; i++) {
      seedRunsForAgent(randomUUID(), 'coder', 6, 'done', NOW)
      seedRunsForAgent(randomUUID(), 'tester', 6, 'done', NOW)
    }
    const c1 = getRoleBaseline('coder')
    const t1 = getRoleBaseline('tester')

    invalidateRoleBaselines()

    const c2 = getRoleBaseline('coder')
    const t2 = getRoleBaseline('tester')

    expect(c2).not.toBe(c1)
    expect(t2).not.toBe(t1)
  })

  it('does not throw when called for an unknown/new agent type', () => {
    // Force TypeScript to accept an arbitrary string via cast (simulates future role addition)
    expect(() => getRoleBaseline('pilot' as Parameters<typeof getRoleBaseline>[0])).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 4. applyRoleBaseline() — normalisation rules and guards
// ---------------------------------------------------------------------------

/** Helper: build a fully-populated AgentHealthMetrics with hasEnoughData=true */
function makeMetrics(overrides: Partial<AgentHealthMetrics> = {}): AgentHealthMetrics {
  return {
    completionRate: 0.8,
    throughputTrend: 1.5,
    errorDensity: 0.2,
    idleSeconds: 3600,
    hasEnoughData: true,
    ...overrides,
  }
}

describe('applyRoleBaseline', () => {
  // ── Guard conditions ────────────────────────────────────────────────────────

  it('returns raw metrics unchanged when baseline is null', () => {
    const raw = makeMetrics()
    expect(applyRoleBaseline(raw, null)).toEqual(raw)
  })

  it('returns raw metrics unchanged when cohortSize < MIN_COHORT_SIZE_FOR_BASELINE', () => {
    const raw = makeMetrics()
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE - 1,
    }
    expect(applyRoleBaseline(raw, baseline)).toEqual(raw)
  })

  it('returns raw metrics unchanged when hasEnoughData is false', () => {
    const raw = makeMetrics({ hasEnoughData: false, completionRate: null, errorDensity: null })
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    expect(applyRoleBaseline(raw, baseline)).toEqual(raw)
  })

  // ── Normalisation — completionRate ──────────────────────────────────────────

  it('normalises completionRate: raw / median, capped at 1', () => {
    const raw = makeMetrics({ completionRate: 0.72 })
    const baseline = {
      medianCompletionRate: 0.70,
      medianErrorDensity: 0.30,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    // 0.72 / 0.70 = 1.028... → capped at 1.0
    expect(result.completionRate).toBe(1)
  })

  it('normalises completionRate below 1 when agent underperforms role', () => {
    const raw = makeMetrics({ completionRate: 0.72 })
    const baseline = {
      medianCompletionRate: 0.92,
      medianErrorDensity: 0.08,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    // 0.72 / 0.92 ≈ 0.782
    expect(result.completionRate).toBeCloseTo(0.72 / 0.92, 10)
    expect(result.completionRate!).toBeLessThan(1)
  })

  it('skips completionRate normalisation when raw completionRate is null', () => {
    const raw = makeMetrics({ completionRate: null })
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.completionRate).toBeNull()
  })

  it('skips completionRate normalisation when baseline median is null', () => {
    const raw = makeMetrics({ completionRate: 0.8 })
    const baseline = {
      medianCompletionRate: null,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.completionRate).toBe(0.8) // unchanged
  })

  it('skips completionRate normalisation when baseline median is zero (division guard)', () => {
    const raw = makeMetrics({ completionRate: 0.8 })
    const baseline = {
      medianCompletionRate: 0,  // would cause division by zero
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.completionRate).toBe(0.8) // unchanged
  })

  // ── Normalisation — errorDensity ────────────────────────────────────────────

  it('normalises errorDensity: raw / median (higher ratio = worse than norm)', () => {
    const raw = makeMetrics({ errorDensity: 0.3 })
    const baseline = {
      medianCompletionRate: 0.7,
      medianErrorDensity: 0.3,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    // 0.3 / 0.3 = 1.0 — exactly at role norm
    expect(result.errorDensity).toBeCloseTo(1.0, 10)
  })

  it('normalises errorDensity below 1 when agent has fewer errors than role norm', () => {
    const raw = makeMetrics({ errorDensity: 0.1 })
    const baseline = {
      medianCompletionRate: 0.7,
      medianErrorDensity: 0.3,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    // 0.1 / 0.3 ≈ 0.333
    expect(result.errorDensity).toBeCloseTo(0.1 / 0.3, 10)
  })

  it('normalises errorDensity above 1 when agent has more errors than role norm', () => {
    const raw = makeMetrics({ errorDensity: 0.6 })
    const baseline = {
      medianCompletionRate: 0.4,
      medianErrorDensity: 0.3,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    // 0.6 / 0.3 = 2.0 — twice the role error rate
    expect(result.errorDensity).toBeCloseTo(2.0, 10)
  })

  it('skips errorDensity normalisation when raw errorDensity is null', () => {
    const raw = makeMetrics({ errorDensity: null })
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.errorDensity).toBeNull()
  })

  it('skips errorDensity normalisation when baseline median is null', () => {
    const raw = makeMetrics({ errorDensity: 0.2 })
    const baseline = {
      medianCompletionRate: 0.8,
      medianErrorDensity: null,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.errorDensity).toBe(0.2) // unchanged
  })

  it('skips errorDensity normalisation when baseline median is zero (division guard)', () => {
    const raw = makeMetrics({ errorDensity: 0.2 })
    const baseline = {
      medianCompletionRate: 0.8,
      medianErrorDensity: 0,  // would cause division by zero
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.errorDensity).toBe(0.2) // unchanged
  })

  // ── Unchanged fields ─────────────────────────────────────────────────────────

  it('leaves throughputTrend unchanged (slope value, not role-dependent)', () => {
    const raw = makeMetrics({ throughputTrend: -2.5 })
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.throughputTrend).toBe(-2.5)
  })

  it('leaves idleSeconds unchanged (absolute wall-clock metric)', () => {
    const raw = makeMetrics({ idleSeconds: 86400 })
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.idleSeconds).toBe(86400)
  })

  it('leaves hasEnoughData unchanged', () => {
    const raw = makeMetrics({ hasEnoughData: true })
    const baseline = {
      medianCompletionRate: 0.9,
      medianErrorDensity: 0.1,
      cohortSize: MIN_COHORT_SIZE_FOR_BASELINE,
    }
    const result = applyRoleBaseline(raw, baseline)
    expect(result.hasEnoughData).toBe(true)
  })

  // ── New role / unknown type graceful degradation ─────────────────────────────

  it('degrades to flat thresholds for a brand-new role with zero baseline data', () => {
    // Simulate a freshly added 6th role with no run history
    const raw = makeMetrics({ completionRate: 0.6, errorDensity: 0.4 })
    const emptyBaseline = {
      medianCompletionRate: null,
      medianErrorDensity: null,
      cohortSize: 0,  // zero — below MIN_COHORT_SIZE_FOR_BASELINE
    }
    const result = applyRoleBaseline(raw, emptyBaseline)
    // Should pass through unchanged — flat thresholds apply
    expect(result).toEqual(raw)
  })
})
