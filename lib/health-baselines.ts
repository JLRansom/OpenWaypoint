/**
 * Per-role aggregate health baselines.
 *
 * Computes and caches median performance metrics per agent role so that
 * `lib/health-cache.ts` can normalise per-agent health scores against the
 * role's own norms rather than flat absolute thresholds.
 *
 * Intended evolution: the in-memory TTL cache here is a stepping stone. Once
 * data volume justifies it, replace `computeRoleBaseline` with a query backed
 * by a persistent materialised view, keeping the `getRoleBaseline` API stable.
 *
 * Usage:
 *   import { getRoleBaseline, invalidateRoleBaselines } from '@/lib/health-baselines'
 */
import { dbGetTaskRunsByRole } from '@/lib/db/repositories/taskRunRepo'
import { computeHealthMetrics, MIN_RUNS_THRESHOLD } from '@/lib/health'
import type { AgentType, TaskRun } from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum number of agents of a given role, each with at least
 * MIN_RUNS_THRESHOLD runs within the baseline window, required to form a
 * statistically meaningful cohort.  Below this we return null-metric
 * baselines and fall back to flat thresholds.
 */
export const MIN_COHORT_SIZE = 3

/**
 * TTL for cached role baselines (5 minutes).
 * Baselines change slowly — far longer than the per-agent 30-second TTL.
 */
export const BASELINE_TTL_MS = 300_000 // 5 minutes

/**
 * Look-back window for baseline computation: 30 days.
 * Wider than the per-agent 7-day rolling window to establish stable role
 * norms rather than sensitive short-term trends.
 */
export const BASELINE_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000 // 30 days

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Aggregate baseline for a single agent role derived from the trailing
 * BASELINE_WINDOW_MS of task run history.
 *
 * Any metric field may be null when the cohort lacks sufficient data (e.g. a
 * role where every agent always succeeds → `medianErrorDensity` is null).
 * Callers must treat null as "baseline unavailable for this metric".
 */
export interface RoleBaseline {
  role: AgentType
  /** Median completion rate across all qualifying agents of this role. */
  medianCompletionRate: number | null
  /** Median error density across all qualifying agents of this role. */
  medianErrorDensity: number | null
  /** Median average weekly task throughput across qualifying agents. */
  medianWeeklyThroughput: number | null
  /** Number of agents that contributed to this baseline. */
  cohortSize: number
  /** Epoch ms when this baseline was last computed. */
  computedAt: number
}

interface CachedBaseline {
  baseline: RoleBaseline
  /** Epoch ms when the cache entry was stored (used for TTL eviction). */
  computedAt: number
}

// ---------------------------------------------------------------------------
// Cache store
// ---------------------------------------------------------------------------

/** In-process TTL cache — keyed by AgentType. */
const baselineCache = new Map<AgentType, CachedBaseline>()

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the sorted median of a numeric array.
 * Returns null for empty arrays rather than NaN so callers get a clean signal.
 */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Computes per-role aggregate health baselines from the trailing
 * BASELINE_WINDOW_MS of task runs.
 *
 * Steps:
 *  1. Fetch all runs for this role within the window via DB.
 *  2. Group by agentId and keep only agents with ≥ MIN_RUNS_THRESHOLD runs.
 *  3. If the qualifying cohort is < MIN_COHORT_SIZE, return null-metric baseline.
 *  4. Compute per-agent metrics; take the median of each metric across agents.
 *
 * @param role - The AgentType to compute baselines for.
 * @param now  - Injectable epoch ms for deterministic testing.
 */
export function computeRoleBaseline(
  role: AgentType,
  now: number = Date.now(),
): RoleBaseline {
  const nullBaseline: RoleBaseline = {
    role,
    medianCompletionRate: null,
    medianErrorDensity: null,
    medianWeeklyThroughput: null,
    cohortSize: 0,
    computedAt: now,
  }

  let runs: TaskRun[]
  try {
    runs = dbGetTaskRunsByRole(role, BASELINE_WINDOW_MS, now)
  } catch {
    // DB error — return null-metrics baseline; caller falls back to flat thresholds
    return nullBaseline
  }

  // Group runs by agentId
  const byAgent = new Map<string, TaskRun[]>()
  for (const run of runs) {
    const existing = byAgent.get(run.agentId) ?? []
    existing.push(run)
    byAgent.set(run.agentId, existing)
  }

  // Only agents with sufficient run history in the window contribute to the baseline
  const windowStart = now - BASELINE_WINDOW_MS
  const qualifyingIds: string[] = []
  for (const [agentId, agentRuns] of byAgent) {
    const windowRuns = agentRuns.filter(
      (r) => r.completedAt >= windowStart && r.completedAt <= now,
    )
    if (windowRuns.length >= MIN_RUNS_THRESHOLD) {
      qualifyingIds.push(agentId)
    }
  }

  if (qualifyingIds.length < MIN_COHORT_SIZE) {
    // Cohort too small — medians would be statistically meaningless
    return { ...nullBaseline, cohortSize: qualifyingIds.length }
  }

  // Collect per-agent metric values for median calculation
  const completionRates: number[] = []
  const errorDensities: number[] = []
  const weeklyThroughputs: number[] = []
  const weeksInWindow = BASELINE_WINDOW_MS / (7 * 24 * 60 * 60 * 1_000)

  for (const agentId of qualifyingIds) {
    const agentRuns = byAgent.get(agentId)!
    const metrics = computeHealthMetrics(agentRuns, now)
    if (!metrics.hasEnoughData) continue

    if (metrics.completionRate !== null) completionRates.push(metrics.completionRate)
    if (metrics.errorDensity !== null) errorDensities.push(metrics.errorDensity)

    // Average weekly throughput = total window runs / weeks in window
    const windowRuns = agentRuns.filter(
      (r) => r.completedAt >= windowStart && r.completedAt <= now,
    )
    weeklyThroughputs.push(windowRuns.length / weeksInWindow)
  }

  return {
    role,
    medianCompletionRate: medianOf(completionRates),
    medianErrorDensity: medianOf(errorDensities),
    medianWeeklyThroughput: medianOf(weeklyThroughputs),
    cohortSize: qualifyingIds.length,
    computedAt: now,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a cached role baseline, recomputing if stale or absent.
 *
 * This function never throws.  On any DB or computation error it returns a
 * stale cached value if one exists, otherwise a safe null-metrics baseline.
 * This ensures health scoring always degrades gracefully rather than crashing.
 */
export function getRoleBaseline(role: AgentType): RoleBaseline {
  const cached = baselineCache.get(role)
  if (cached && Date.now() - cached.computedAt < BASELINE_TTL_MS) {
    return cached.baseline
  }

  try {
    const baseline = computeRoleBaseline(role)
    baselineCache.set(role, { baseline, computedAt: Date.now() })
    return baseline
  } catch {
    // On recomputation failure, prefer a stale cached value over nothing
    if (cached) return cached.baseline
    return {
      role,
      medianCompletionRate: null,
      medianErrorDensity: null,
      medianWeeklyThroughput: null,
      cohortSize: 0,
      computedAt: Date.now(),
    }
  }
}

/**
 * Invalidates cached baselines.
 * - If `role` is provided, clears only that role's cached entry.
 * - If omitted, clears all roles.
 *
 * Call this when an agent is created or deleted (cohort size may shift), or
 * when a new AgentType is added to the system.
 */
export function invalidateRoleBaselines(role?: AgentType): void {
  if (role !== undefined) {
    baselineCache.delete(role)
  } else {
    baselineCache.clear()
  }
}
