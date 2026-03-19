import { computeHealthMetrics, applyRoleBaseline } from '@/lib/health'
import { dbGetTaskRunsByAgent } from '@/lib/db/repositories/taskRunRepo'
import { dbGetAgent } from '@/lib/db/repositories/agentRepo'
import { getRoleBaseline } from '@/lib/health-baselines'
import type { AgentHealthMetrics } from '@/lib/types'

// ---------------------------------------------------------------------------
// Cache store
// ---------------------------------------------------------------------------

interface CachedEntry {
  metrics: AgentHealthMetrics
  computedAt: number
}

/** In-process TTL cache — keyed by agentId. */
const cache = new Map<string, CachedEntry>()

/** Default TTL: 30 seconds.  Override via second parameter for tests. */
export const DEFAULT_TTL_MS = 30_000

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns cached metrics for an agent if they are within the TTL window,
 * otherwise returns null (caller should recompute).
 */
export function getCachedHealthMetrics(
  agentId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): AgentHealthMetrics | null {
  const entry = cache.get(agentId)
  if (!entry) return null
  if (Date.now() - entry.computedAt >= ttlMs) return null
  return entry.metrics
}

/**
 * Queries the DB for all task runs belonging to this agent, computes health
 * metrics, applies role-relative baseline normalisation when the
 * `ROLE_BASELINES_ENABLED` environment variable is set to `"true"`, stores
 * the result in the cache, and returns it.
 *
 * Role-baseline normalisation is gated behind the feature flag so the code
 * can be deployed without activating it, enabling an A/B comparison of badge
 * behaviour and an emergency rollback without a code revert.
 */
export function computeAndCacheHealthMetrics(agentId: string): AgentHealthMetrics {
  const runs = dbGetTaskRunsByAgent(agentId)
  const raw = computeHealthMetrics(runs)

  let metrics = raw

  if (process.env.ROLE_BASELINES_ENABLED === 'true') {
    // Look up the agent's role so we can fetch the correct cohort baseline.
    // dbGetAgent returns undefined for unknown ids; we degrade to flat thresholds
    // in that case (applyRoleBaseline treats a null baseline as a no-op).
    const agent = dbGetAgent(agentId)
    if (agent) {
      const baseline = getRoleBaseline(agent.type)
      metrics = applyRoleBaseline(raw, baseline)
    }
  }

  cache.set(agentId, { metrics, computedAt: Date.now() })
  return metrics
}

/**
 * Invalidates cached metrics.
 * - If agentId is provided, clears only that agent's entry.
 * - If omitted, clears the entire cache.
 */
export function invalidateHealthCache(agentId?: string): void {
  if (agentId !== undefined) {
    cache.delete(agentId)
  } else {
    cache.clear()
  }
}
