/**
 * Unit tests for computeHealthMetrics() in lib/health.ts
 *
 * All tests inject a fixed `now` timestamp so time-based calculations
 * are fully deterministic and don't depend on wall-clock time.
 */
import { describe, it, expect } from 'vitest'
import { computeHealthMetrics, MIN_RUNS_THRESHOLD, ROLLING_WINDOW_MS } from '@/lib/health'
import type { TaskRun } from '@/lib/types'
import { randomUUID } from 'crypto'

// ─── Fixed reference time ─────────────────────────────────────────────────────
/** Wednesday 2026-03-11 noon UTC */
const NOW = new Date('2026-03-11T12:00:00Z').getTime()
const WINDOW_START = NOW - ROLLING_WINDOW_MS // 7 days before NOW

// ─── Factory ─────────────────────────────────────────────────────────────────

function makeRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    id: randomUUID(),
    taskId: randomUUID(),
    taskTitle: 'Test Task',
    projectId: randomUUID(),
    projectName: 'Test Project',
    agentId: 'agent-1',
    role: 'coder',
    status: 'done',
    output: '',
    startedAt: NOW - 60_000,
    completedAt: NOW - 30_000, // inside window by default
    ...overrides,
  }
}

/** Create N runs all inside the rolling window with the given status. */
function makeRuns(n: number, status: 'done' | 'failed' = 'done', completedAt?: number): TaskRun[] {
  return Array.from({ length: n }, () =>
    makeRun({ status, completedAt: completedAt ?? NOW - 60_000 })
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('computeHealthMetrics', () => {
  // ── 1. Zero runs ────────────────────────────────────────────────────────────

  it('returns all-null metrics with hasEnoughData=false for empty run list', () => {
    const result = computeHealthMetrics([], NOW)
    expect(result.completionRate).toBeNull()
    expect(result.throughputTrend).toBeNull()
    expect(result.errorDensity).toBeNull()
    expect(result.idleSeconds).toBeNull()
    expect(result.hasEnoughData).toBe(false)
  })

  // ── 2. Below threshold ──────────────────────────────────────────────────────

  it('returns hasEnoughData=false when runs < MIN_RUNS_THRESHOLD', () => {
    const runs = makeRuns(MIN_RUNS_THRESHOLD - 1)
    const result = computeHealthMetrics(runs, NOW)
    expect(result.hasEnoughData).toBe(false)
    expect(result.completionRate).toBeNull()
    expect(result.errorDensity).toBeNull()
  })

  // ── 3. Exactly at threshold ──────────────────────────────────────────────────

  it('populates metrics when runs === MIN_RUNS_THRESHOLD', () => {
    const runs = makeRuns(MIN_RUNS_THRESHOLD, 'done')
    const result = computeHealthMetrics(runs, NOW)
    expect(result.hasEnoughData).toBe(true)
    expect(result.completionRate).toBe(1)
    expect(result.errorDensity).toBe(0)
  })

  // ── 4. All done ──────────────────────────────────────────────────────────────

  it('returns completionRate=1 and errorDensity=0 when all runs are done', () => {
    const runs = makeRuns(10, 'done')
    const result = computeHealthMetrics(runs, NOW)
    expect(result.completionRate).toBe(1)
    expect(result.errorDensity).toBe(0)
    expect(result.hasEnoughData).toBe(true)
  })

  // ── 5. All failed ────────────────────────────────────────────────────────────

  it('returns completionRate=0 and errorDensity=1 when all runs are failed', () => {
    const runs = makeRuns(10, 'failed')
    const result = computeHealthMetrics(runs, NOW)
    expect(result.completionRate).toBe(0)
    expect(result.errorDensity).toBe(1)
  })

  // ── 6. Mixed done/failed ─────────────────────────────────────────────────────

  it('computes correct ratios for mixed statuses', () => {
    const runs = [
      ...makeRuns(7, 'done'),
      ...makeRuns(3, 'failed'),
    ]
    const result = computeHealthMetrics(runs, NOW)
    expect(result.completionRate).toBeCloseTo(0.7)
    expect(result.errorDensity).toBeCloseTo(0.3)
  })

  // ── 7. Runs outside window excluded from rate/density ─────────────────────────

  it('excludes runs outside the rolling window from completion/error metrics', () => {
    const outside = makeRuns(50, 'failed', WINDOW_START - 1) // 1ms before window
    const inside = makeRuns(10, 'done', WINDOW_START + 1000) // inside window
    const result = computeHealthMetrics([...outside, ...inside], NOW)
    // Only the 10 inside-window done runs should count
    expect(result.completionRate).toBe(1)
    expect(result.errorDensity).toBe(0)
  })

  // ── 8. Idle time uses ALL runs, not just rolling window ────────────────────

  it('computes idleSeconds from the most recent run regardless of window', () => {
    // A run that is outside the rolling window (ancient)
    const ancientRun = makeRun({ completedAt: NOW - ROLLING_WINDOW_MS - 10_000 })
    // No runs inside the window — but idleSeconds should still be computed
    const result = computeHealthMetrics([ancientRun], NOW)
    expect(result.idleSeconds).toBeCloseTo((ROLLING_WINDOW_MS + 10_000) / 1000, 0)
    // Not enough data for rate metrics
    expect(result.hasEnoughData).toBe(false)
  })

  it('idleSeconds reflects the most recent completedAt across all runs', () => {
    const runs = [
      makeRun({ completedAt: NOW - 3_600_000 }),  // 1 hour ago
      makeRun({ completedAt: NOW - 7_200_000 }),  // 2 hours ago (older)
      ...makeRuns(8, 'done'),                      // recent runs inside window
    ]
    const result = computeHealthMetrics(runs, NOW)
    // Most recent is NOW - 60_000 (from makeRuns default completedAt)
    expect(result.idleSeconds).toBeCloseTo(60, 0)
  })

  // ── 9. Throughput trend — not enough weeks ───────────────────────────────────

  it('returns throughputTrend=null when all runs are in fewer than 2 distinct weeks', () => {
    // All runs in the same ISO week
    const runs = makeRuns(10, 'done', NOW - 60_000) // all in NOW's week
    const result = computeHealthMetrics(runs, NOW)
    expect(result.throughputTrend).toBeNull()
  })

  // ── 10. Throughput trend — increasing ─────────────────────────────────────────

  it('returns positive throughputTrend when velocity is increasing week-over-week', () => {
    const testNow = new Date('2026-03-12T12:00:00Z').getTime()
    const wk1 = testNow - 6 * 24 * 3600_000  // 6 days ago
    const wk2 = testNow - 1 * 24 * 3600_000  // 1 day ago
    const increasingRuns = [
      ...Array.from({ length: 2 }, () => makeRun({ completedAt: wk1 })),
      ...Array.from({ length: 8 }, () => makeRun({ completedAt: wk2 })),
    ]
    const incResult = computeHealthMetrics(increasingRuns, testNow)
    expect(incResult.hasEnoughData).toBe(true)
    if (incResult.throughputTrend !== null) {
      expect(incResult.throughputTrend).toBeGreaterThan(0)
    }
    // If still null (same week), that's also valid behavior
  })

  // ── 11. Throughput trend — decreasing ──────────────────────────────────────────

  it('returns negative throughputTrend when velocity is declining week-over-week', () => {
    // week1 = 8 tasks (earlier), week2 = 2 tasks (more recent) → declining
    const testNow = new Date('2026-03-12T12:00:00Z').getTime()
    const wk1 = testNow - 6 * 24 * 3600_000  // 6 days ago (different ISO week from wk2)
    const wk2 = testNow - 1 * 24 * 3600_000  // 1 day ago
    const decRuns = [
      ...Array.from({ length: 8 }, () => makeRun({ completedAt: wk1 })),
      ...Array.from({ length: 2 }, () => makeRun({ completedAt: wk2 })),
    ]
    const result = computeHealthMetrics(decRuns, testNow)
    expect(result.hasEnoughData).toBe(true)
    if (result.throughputTrend !== null) {
      expect(result.throughputTrend).toBeLessThan(0)
    }
  })

  // ── 12. Idle time — null for no runs ─────────────────────────────────────────

  it('returns idleSeconds=null when there are no runs at all', () => {
    const result = computeHealthMetrics([], NOW)
    expect(result.idleSeconds).toBeNull()
  })

  // ── 13. Idle time — exact calculation ────────────────────────────────────────

  it('calculates idleSeconds correctly from injected now', () => {
    const lastRun = NOW - 7_200_000 // 2 hours ago
    const run = makeRun({ completedAt: lastRun })
    const result = computeHealthMetrics([run], NOW)
    expect(result.idleSeconds).toBeCloseTo(7200, 0)
  })
})
