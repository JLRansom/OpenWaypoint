/**
 * Integration tests for getStreamPayload() in lib/store.ts
 *
 * Focus: the `agentHealth` map that was introduced alongside the health-cache
 * feature.  We verify:
 *   1. The payload contains an `agentHealth` key.
 *   2. Each agent in the payload has a corresponding entry in `agentHealth`.
 *   3. The entry has the expected AgentHealthMetrics shape.
 *   4. An agent with insufficient run history has `hasEnoughData: false`.
 *   5. An agent with enough run history has `hasEnoughData: true` and
 *      numeric metric values.
 *
 * Strategy:
 *  - We call addAgent() + dbAddTaskRun() to set up state in the real (temp)
 *    SQLite database.  getStreamPayload() reads from that DB directly.
 *  - Health cache TTL is effectively bypassed because each test file gets a
 *    fresh module registry (vitest isolate: true) so the in-memory cache Map
 *    always starts empty.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import { getStreamPayload, addProject, addAgent } from '@/lib/store'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { invalidateHealthCache } from '@/lib/health-cache'
import { makeTestProject, makeTestAgent, makeTestTaskRun } from '../helpers/test-utils'
import type { AgentHealthMetrics } from '@/lib/types'

// ─── Timestamps ───────────────────────────────────────────────────────────────
//
// computeHealthMetrics() uses Date.now() to define the rolling 7-day window.
// We must seed runs *within* that window, so we anchor relative to Date.now()
// rather than a fixed past date.

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getStreamPayload — agentHealth map', () => {
  let projectId: string
  let sparseAgentId: string
  let richAgentId: string

  beforeAll(() => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id

    // Sparse agent — no task runs; health data will be insufficient
    const sparseAgent = makeTestAgent({ type: 'coder', projectId })
    addAgent(sparseAgent)
    sparseAgentId = sparseAgent.id

    // Rich agent — seed enough runs to have meaningful metrics
    const richAgent = makeTestAgent({ type: 'researcher', projectId })
    addAgent(richAgent)
    richAgentId = richAgent.id

    // Seed 5 done runs within the rolling 7-day window.
    // We anchor to Date.now() so the timestamps are always "recent" regardless
    // of when the test suite is executed.
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      const completedAt = now - i * 3_600_000   // 1 hour apart, all within 24 h
      const run = makeTestTaskRun(projectId, {
        agentId: richAgentId,
        status: 'done',
        completedAt,
        startedAt: completedAt - 30_000,
      })
      dbAddTaskRun(run)
    }

    // Ensure the health cache is clear so getStreamPayload recomputes
    invalidateHealthCache()
  })

  // ── 1. Payload shape ───────────────────────────────────────────────────────

  it('payload contains an `agentHealth` key', () => {
    const payload = getStreamPayload()
    expect(payload).toHaveProperty('agentHealth')
    expect(typeof payload.agentHealth).toBe('object')
    expect(payload.agentHealth).not.toBeNull()
  })

  // ── 2. Agent-to-entry mapping ──────────────────────────────────────────────

  it('every agent in payload.agents has a corresponding entry in agentHealth', () => {
    const payload = getStreamPayload()
    for (const agent of payload.agents) {
      expect(payload.agentHealth).toHaveProperty(agent.id)
    }
  })

  // ── 3. AgentHealthMetrics shape ────────────────────────────────────────────

  it('each agentHealth entry has the expected AgentHealthMetrics shape', () => {
    const payload = getStreamPayload()
    const entries = Object.values(payload.agentHealth ?? {}) as AgentHealthMetrics[]
    expect(entries.length).toBeGreaterThan(0)

    for (const metrics of entries) {
      expect(typeof metrics.hasEnoughData).toBe('boolean')
      // These four fields must be either null or a finite number
      for (const field of ['completionRate', 'throughputTrend', 'errorDensity', 'idleSeconds'] as const) {
        const val = metrics[field]
        expect(val === null || (typeof val === 'number' && isFinite(val))).toBe(true)
      }
    }
  })

  // ── 4. Sparse agent — not enough data ─────────────────────────────────────

  it('agent with no runs has hasEnoughData: false', () => {
    const payload = getStreamPayload()
    const metrics = payload.agentHealth?.[sparseAgentId]
    expect(metrics).toBeDefined()
    expect(metrics!.hasEnoughData).toBe(false)
  })

  // ── 5. Rich agent — sufficient data ───────────────────────────────────────

  it('agent with sufficient runs has hasEnoughData: true and non-null completionRate', () => {
    const payload = getStreamPayload()
    const metrics = payload.agentHealth?.[richAgentId]
    expect(metrics).toBeDefined()
    expect(metrics!.hasEnoughData).toBe(true)
    // All runs are 'done' → completionRate should be 1 (100%)
    expect(metrics!.completionRate).not.toBeNull()
    expect(metrics!.completionRate).toBeCloseTo(1)
  })
})
