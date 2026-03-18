import { computeHealthMetrics, ROLLING_WINDOW_MS } from '@/lib/health'
import { dbGetTaskRunsByAgent } from '@/lib/db/repositories/taskRunRepo'
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
 * metrics, stores the result in the cache, and returns it.
 */
export function computeAndCacheHealthMetrics(agentId: string): AgentHealthMetrics {
  const runs = dbGetTaskRunsByAgent(agentId)
  const metrics = computeHealthMetrics(runs)
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
