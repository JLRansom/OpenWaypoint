import type { TaskRun, AgentHealthMetrics } from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rolling window for completion rate, error density, and throughput (7 days). */
export const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Minimum number of completed task runs within the rolling window required
 * for metrics to be considered meaningful.  Below this threshold every metric
 * is returned as null with hasEnoughData: false.
 */
export const MIN_RUNS_THRESHOLD = 5

/**
 * Minimum number of distinct ISO-week buckets required to compute a
 * throughput trend.  With fewer buckets the slope is statistically meaningless.
 */
export const MIN_WEEKS_FOR_TREND = 2

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the ISO week key "YYYY-Www" for an epoch ms timestamp. */
function isoWeekKey(epochMs: number): string {
  const d = new Date(epochMs)
  // ISO week: Thursday's year determines the week-year.
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() + (4 - (d.getUTCDay() || 7)))
  const year = thursday.getUTCFullYear()
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const weekNum = Math.ceil(((thursday.getTime() - startOfYear.getTime()) / 86400000 + 1) / 7)
  return `${year}-W${String(weekNum).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Core calculation
// ---------------------------------------------------------------------------

/**
 * Computes health sub-metrics for a single agent from its task run history.
 *
 * @param taskRuns - All task runs attributed to this agent (caller provides; may be empty).
 * @param now      - Current epoch ms.  Injectable so tests can fix time.  Defaults to Date.now().
 */
export function computeHealthMetrics(
  taskRuns: TaskRun[],
  now: number = Date.now(),
): AgentHealthMetrics {
  // --- Idle time uses ALL runs regardless of rolling window ---
  let maxCompletedAt: number | null = null
  for (const r of taskRuns) {
    if (maxCompletedAt === null || r.completedAt > maxCompletedAt) {
      maxCompletedAt = r.completedAt
    }
  }
  const idleSeconds = maxCompletedAt !== null ? (now - maxCompletedAt) / 1000 : null

  // --- Rolling window filter for completion rate, error density, throughput ---
  const windowStart = now - ROLLING_WINDOW_MS
  const windowRuns = taskRuns.filter((r) => r.completedAt >= windowStart && r.completedAt <= now)

  if (windowRuns.length < MIN_RUNS_THRESHOLD) {
    return {
      completionRate: null,
      throughputTrend: null,
      errorDensity: null,
      idleSeconds,
      hasEnoughData: false,
    }
  }

  // --- Completion rate & error density ---
  let doneCount = 0
  let failedCount = 0
  for (const r of windowRuns) {
    if (r.status === 'done') doneCount++
    else if (r.status === 'failed') failedCount++
  }
  const total = doneCount + failedCount
  const completionRate = total > 0 ? doneCount / total : null
  const errorDensity = total > 0 ? failedCount / total : null

  // --- Throughput trend ---
  // Group runs by ISO week and compute slope.
  const weekMap = new Map<string, number>()
  for (const r of windowRuns) {
    const key = isoWeekKey(r.completedAt)
    weekMap.set(key, (weekMap.get(key) ?? 0) + 1)
  }

  let throughputTrend: number | null = null
  if (weekMap.size >= MIN_WEEKS_FOR_TREND) {
    // Sort weeks chronologically and compute simple linear regression slope.
    const sortedWeeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    const n = sortedWeeks.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n; i++) {
      const y = sortedWeeks[i][1]
      sumX += i
      sumY += y
      sumXY += i * y
      sumX2 += i * i
    }
    const denominator = n * sumX2 - sumX * sumX
    throughputTrend = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0
  }

  return {
    completionRate,
    throughputTrend,
    errorDensity,
    idleSeconds,
    hasEnoughData: true,
  }
}
