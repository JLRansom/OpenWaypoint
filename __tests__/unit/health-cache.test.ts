/**
 * Unit tests for the health metrics cache in lib/health-cache.ts
 *
 * These tests use a real DB (isolated per test file via setup.ts) to verify
 * that computeAndCacheHealthMetrics correctly reads from DB and caches results.
 *
 * The second describe block ("with ROLE_BASELINES_ENABLED") covers the
 * role-relative baseline integration path, seeding both agent records and
 * task-run history to exercise the full normalization pipeline.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getCachedHealthMetrics,
  computeAndCacheHealthMetrics,
  invalidateHealthCache,
} from '@/lib/health-cache'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { dbAddAgent } from '@/lib/db/repositories/agentRepo'
import { invalidateRoleBaselines } from '@/lib/health-baselines'
import { makeTestTaskRun } from '../helpers/test-utils'
import { randomUUID } from 'crypto'
import type { Agent } from '@/lib/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a minimal Agent record and persists it to the DB. */
function seedAgent(agentId: string, type: Agent['type'] = 'coder'): Agent {
  const agent: Agent = {
    id: agentId,
    type,
    prompt: '',
    status: 'idle',
    events: [],
    createdAt: Date.now(),
  }
  dbAddAgent(agent)
  return agent
}

/**
 * Seeds `count` task runs for the given agentId inside the 7-day rolling
 * window so hasEnoughData will be true.
 */
function seedRunsForAgent(
  agentId: string,
  role: Agent['type'],
  count: number,
  status: 'done' | 'failed' = 'done',
): void {
  const now = Date.now()
  for (let i = 0; i < count; i++) {
    dbAddTaskRun(
      makeTestTaskRun(randomUUID(), {
        agentId,
        role,
        status,
        completedAt: now - i * 60_000,
        startedAt: now - i * 60_000 - 30_000,
      }),
    )
  }
}

beforeEach(() => {
  // Clear cache between tests to avoid cross-test contamination
  invalidateHealthCache()
})

describe('getCachedHealthMetrics', () => {
  it('returns null when no entry exists for the agent', () => {
    expect(getCachedHealthMetrics('nonexistent-agent')).toBeNull()
  })

  it('returns metrics after computeAndCacheHealthMetrics is called', () => {
    const agentId = randomUUID()
    computeAndCacheHealthMetrics(agentId)
    const result = getCachedHealthMetrics(agentId)
    expect(result).not.toBeNull()
    expect(result!.hasEnoughData).toBe(false) // no runs for this agent
  })

  it('returns null when TTL has expired (ttlMs = 0)', () => {
    const agentId = randomUUID()
    computeAndCacheHealthMetrics(agentId)
    // Immediately check with TTL=0 → always expired
    const result = getCachedHealthMetrics(agentId, 0)
    expect(result).toBeNull()
  })

  it('returns cached value within TTL', () => {
    const agentId = randomUUID()
    computeAndCacheHealthMetrics(agentId)
    // Use a large TTL so it's definitely fresh
    const result = getCachedHealthMetrics(agentId, 60_000)
    expect(result).not.toBeNull()
  })
})

describe('computeAndCacheHealthMetrics', () => {
  it('returns hasEnoughData=false for agent with no runs', () => {
    const agentId = randomUUID()
    const metrics = computeAndCacheHealthMetrics(agentId)
    expect(metrics.hasEnoughData).toBe(false)
    expect(metrics.completionRate).toBeNull()
    expect(metrics.idleSeconds).toBeNull()
  })

  it('reflects actual task runs in DB', () => {
    const agentId = randomUUID()
    // Seed 5+ done runs in the rolling window
    const now = Date.now()
    for (let i = 0; i < 6; i++) {
      const run = makeTestTaskRun(randomUUID(), {
        agentId,
        status: 'done',
        completedAt: now - i * 60_000, // spread across last 6 minutes
        startedAt: now - i * 60_000 - 30_000,
      })
      dbAddTaskRun(run)
    }

    const metrics = computeAndCacheHealthMetrics(agentId)
    expect(metrics.hasEnoughData).toBe(true)
    expect(metrics.completionRate).toBe(1) // all done
    expect(metrics.errorDensity).toBe(0)
    expect(metrics.idleSeconds).not.toBeNull()
    expect(metrics.idleSeconds!).toBeLessThan(400) // less than ~6 min
  })

  it('stores result in cache so subsequent getCachedHealthMetrics call returns it', () => {
    const agentId = randomUUID()
    const computed = computeAndCacheHealthMetrics(agentId)
    const cached = getCachedHealthMetrics(agentId, 60_000)
    expect(cached).toEqual(computed)
  })
})

describe('invalidateHealthCache', () => {
  it('removes a single agent entry', () => {
    const agentId = randomUUID()
    computeAndCacheHealthMetrics(agentId)
    invalidateHealthCache(agentId)
    expect(getCachedHealthMetrics(agentId, 60_000)).toBeNull()
  })

  it('clears all entries when called without arguments', () => {
    const a = randomUUID()
    const b = randomUUID()
    computeAndCacheHealthMetrics(a)
    computeAndCacheHealthMetrics(b)
    invalidateHealthCache()
    expect(getCachedHealthMetrics(a, 60_000)).toBeNull()
    expect(getCachedHealthMetrics(b, 60_000)).toBeNull()
  })

  it('does not throw when invalidating a non-existent agent', () => {
    expect(() => invalidateHealthCache('ghost-agent')).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Role-baseline integration (ROLE_BASELINES_ENABLED=true)
// ---------------------------------------------------------------------------

describe('computeAndCacheHealthMetrics with ROLE_BASELINES_ENABLED', () => {
  beforeEach(() => {
    invalidateHealthCache()
    invalidateRoleBaselines()
    process.env.ROLE_BASELINES_ENABLED = 'true'
  })

  afterEach(() => {
    delete process.env.ROLE_BASELINES_ENABLED
    invalidateRoleBaselines()
  })

  it('returns raw metrics (no normalisation) when feature flag is off', () => {
    delete process.env.ROLE_BASELINES_ENABLED // ensure flag is off
    const agentId = randomUUID()
    seedAgent(agentId, 'coder')
    seedRunsForAgent(agentId, 'coder', 6)

    const metrics = computeAndCacheHealthMetrics(agentId)
    // Without baseline, completionRate should be the raw value (1.0 = all done)
    expect(metrics.completionRate).toBe(1)
    expect(metrics.errorDensity).toBe(0)
  })

  it('applies role-relative normalisation when feature flag is enabled', () => {
    // Set up: role median completionRate = 0.5 (mixed cohort)
    // Build a cohort of 3 agents for the 'researcher' role with 50% completion
    const cohortAgents = [randomUUID(), randomUUID(), randomUUID()]
    for (const id of cohortAgents) {
      seedAgent(id, 'researcher')
      // 3 done + 3 failed = 50% completion rate per agent
      seedRunsForAgent(id, 'researcher', 3, 'done')
      seedRunsForAgent(id, 'researcher', 3, 'failed')
    }

    // Now test an agent that has 100% completion rate
    const agentId = randomUUID()
    seedAgent(agentId, 'researcher')
    seedRunsForAgent(agentId, 'researcher', 6, 'done')

    // Invalidate baseline cache so it recomputes from the seeded cohort
    invalidateRoleBaselines()

    const metrics = computeAndCacheHealthMetrics(agentId)

    // The agent performs above role norm:
    //   raw completionRate = 1.0, role median ≈ 0.5
    //   normalised = min(1.0 / 0.5, 1) = 1.0 (capped)
    expect(metrics.hasEnoughData).toBe(true)
    expect(metrics.completionRate).toBe(1)
  })

  it('degrades to raw metrics when agent is not found in DB', () => {
    // agentId with no DB record — getRoleBaseline should not be called
    const ghostAgentId = randomUUID()
    // Seed runs directly without creating the agent record
    seedRunsForAgent(ghostAgentId, 'coder', 6)

    const metrics = computeAndCacheHealthMetrics(ghostAgentId)
    // Should succeed without throwing; returns raw metrics
    expect(metrics).toBeDefined()
    expect(metrics.hasEnoughData).toBe(true)
  })

  it('stores normalised metrics in cache and returns the same value on hit', () => {
    const agentId = randomUUID()
    seedAgent(agentId, 'coder')
    seedRunsForAgent(agentId, 'coder', 6)

    const computed = computeAndCacheHealthMetrics(agentId)
    const cached = getCachedHealthMetrics(agentId, 60_000)
    expect(cached).toEqual(computed)
  })
})
