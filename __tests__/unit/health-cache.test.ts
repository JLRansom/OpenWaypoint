/**
 * Unit tests for the health metrics cache in lib/health-cache.ts
 *
 * These tests use a real DB (isolated per test file via setup.ts) to verify
 * that computeAndCacheHealthMetrics correctly reads from DB and caches results.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCachedHealthMetrics,
  computeAndCacheHealthMetrics,
  invalidateHealthCache,
} from '@/lib/health-cache'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { makeTestTaskRun } from '../helpers/test-utils'
import { randomUUID } from 'crypto'

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
