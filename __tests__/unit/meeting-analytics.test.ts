/**
 * Unit tests for dbGetMeetingAnalytics() in lib/db/repositories/analyticsRepo.ts
 *
 * Strategy:
 *  - Each describe block creates its own project so there is no cross-test
 *    contamination (DB is isolated per-worker by the vitest setup).
 *  - We seed meetings + messages directly via repo functions, then assert on
 *    the aggregated output.
 *  - We never assert string date-labels because shortDateLabel() is
 *    locale-/timezone-dependent; we assert numeric totals and array lengths.
 *
 * Timezone note: all timestamps use noon UTC to stay safely inside a single
 * calendar day regardless of the test runner's local timezone.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import { dbGetMeetingAnalytics } from '@/lib/db/repositories/analyticsRepo'
import { dbAddMeeting, dbAddMeetingMessage, dbUpdateMeetingMessage } from '@/lib/db/repositories/meetingRepo'
import { addProject } from '@/lib/store'
import { makeTestProject, makeTestMeeting } from '../helpers/test-utils'

// ─── Fixed timestamps ─────────────────────────────────────────────────────────

/** 2026-03-09 noon UTC */
const D1 = new Date('2026-03-09T12:00:00Z').getTime()
/** 2026-03-10 noon UTC */
const D2 = new Date('2026-03-10T12:00:00Z').getTime()
/** 2026-03-11 noon UTC */
const D3 = new Date('2026-03-11T12:00:00Z').getTime()

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Seed a meeting with messages into the DB and return the meeting ID.
 *
 * Note: dbAddMeetingMessage() only persists the basic content/status fields.
 * Token and cost stats are written via dbUpdateMeetingMessage() — matching
 * how the production code works (messages are inserted blank, then updated
 * as the agent streams its response).
 */
function seedMeeting(
  projectId: string,
  createdAt: number,
  messages: { inputTokens?: number; outputTokens?: number; costUsd?: number }[] = [],
  status: 'concluded' | 'setup' | 'discussion' = 'concluded',
): string {
  const { meeting, messages: msgDefaults } = makeTestMeeting(
    projectId,
    { id: randomUUID(), createdAt, updatedAt: createdAt, status },
    messages,
  )
  dbAddMeeting(meeting)
  for (const msg of msgDefaults) {
    const rowId = dbAddMeetingMessage(msg)
    // Persist token/cost stats via update (mirroring production flow)
    dbUpdateMeetingMessage(rowId, {
      inputTokens:  msg.inputTokens,
      outputTokens: msg.outputTokens,
      costUsd:      msg.costUsd,
      model:        msg.model,
    })
  }
  return meeting.id
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('dbGetMeetingAnalytics', () => {
  // ── 1. Empty project ───────────────────────────────────────────────────────

  describe('empty project (no meetings)', () => {
    let projectId: string

    beforeAll(() => {
      const project = makeTestProject()
      addProject(project)
      projectId = project.id
    })

    it('returns zero totals and an empty meetingsByDay array', () => {
      const result = dbGetMeetingAnalytics(projectId)
      expect(result.totalMeetings).toBe(0)
      expect(result.totalMeetingCostUsd).toBe(0)
      expect(result.totalMeetingTokens).toBe(0)
      expect(result.meetingsByDay).toEqual([])
    })
  })

  // ── 2. Single concluded meeting ────────────────────────────────────────────

  it('returns correct token and cost totals for a single concluded meeting', () => {
    const project = makeTestProject()
    addProject(project)

    seedMeeting(project.id, D1, [
      { inputTokens: 200, outputTokens: 100, costUsd: 0.005 },
      { inputTokens: 300, outputTokens: 150, costUsd: 0.008 },
    ])

    const result = dbGetMeetingAnalytics(project.id)
    expect(result.totalMeetings).toBe(1)
    expect(result.totalMeetingTokens).toBe(200 + 100 + 300 + 150) // 750
    expect(result.totalMeetingCostUsd).toBeCloseTo(0.005 + 0.008)   // 0.013
  })

  // ── 3. Multiple meetings — daily grouping ──────────────────────────────────

  it('groups meetings on different UTC days into separate meetingsByDay buckets', () => {
    const project = makeTestProject()
    addProject(project)

    seedMeeting(project.id, D1, [{ inputTokens: 100, outputTokens: 50, costUsd: 0.001 }])
    seedMeeting(project.id, D1, [{ inputTokens: 100, outputTokens: 50, costUsd: 0.001 }]) // same day
    seedMeeting(project.id, D2, [{ inputTokens: 200, outputTokens: 80, costUsd: 0.002 }]) // different day

    const result = dbGetMeetingAnalytics(project.id)
    expect(result.totalMeetings).toBe(3)
    expect(result.meetingsByDay).toHaveLength(2) // D1 and D2

    // Sorted chronologically — D1 bucket must come before D2 bucket
    const [day1, day2] = result.meetingsByDay
    expect(day1.count).toBe(2)  // two meetings on D1
    expect(day2.count).toBe(1)  // one meeting on D2
  })

  // ── 4. Status filter — excludes non-concluded meetings ────────────────────

  it('does not include meetings whose status is not "concluded"', () => {
    const project = makeTestProject()
    addProject(project)

    // One concluded, one in 'setup' status
    seedMeeting(project.id, D1, [{ inputTokens: 100, outputTokens: 50, costUsd: 0.001 }], 'concluded')
    seedMeeting(project.id, D1, [{ inputTokens: 999, outputTokens: 999, costUsd: 9.99 }], 'setup')

    const result = dbGetMeetingAnalytics(project.id)
    expect(result.totalMeetings).toBe(1) // only the concluded one
    // The setup meeting's 9.99 must NOT be included
    expect(result.totalMeetingCostUsd).toBeCloseTo(0.001)
  })

  // ── 5. Project isolation ───────────────────────────────────────────────────

  it('only includes meetings belonging to the requested project', () => {
    const projectA = makeTestProject()
    const projectB = makeTestProject()
    addProject(projectA)
    addProject(projectB)

    seedMeeting(projectA.id, D1, [{ inputTokens: 100, outputTokens: 50, costUsd: 0.01 }])
    seedMeeting(projectA.id, D1, [{ inputTokens: 100, outputTokens: 50, costUsd: 0.01 }])
    // Project B's meeting should be invisible when querying project A
    seedMeeting(projectB.id, D1, [{ inputTokens: 9999, outputTokens: 9999, costUsd: 99.99 }])

    const result = dbGetMeetingAnalytics(projectA.id)
    expect(result.totalMeetings).toBe(2)
    expect(result.totalMeetingCostUsd).toBeCloseTo(0.02)
  })

  // ── 6. Date range filtering ────────────────────────────────────────────────

  it('respects `from` and `to` date range filters', () => {
    const project = makeTestProject()
    addProject(project)

    seedMeeting(project.id, D1, [{ costUsd: 0.01 }]) // before from → excluded
    seedMeeting(project.id, D2, [{ costUsd: 0.02 }]) // within range → included
    seedMeeting(project.id, D3, [{ costUsd: 0.03 }]) // after to → excluded

    const result = dbGetMeetingAnalytics(project.id, D2, D2)
    expect(result.totalMeetings).toBe(1)
    expect(result.totalMeetingCostUsd).toBeCloseTo(0.02)
  })

  // ── 7. Null-token / null-cost messages ────────────────────────────────────

  it('treats null inputTokens / outputTokens / costUsd as 0', () => {
    const project = makeTestProject()
    addProject(project)

    // Seed a message with all numeric fields unset (null in DB)
    const { meeting } = makeTestMeeting(project.id, { createdAt: D1, updatedAt: D1 })
    dbAddMeeting(meeting)
    dbAddMeetingMessage({
      meetingId: meeting.id,
      agentType: 'writer',
      content: 'empty stats',
      status: 'done',
      // No tokens or cost provided — they default to null in the repo
    })

    const result = dbGetMeetingAnalytics(project.id)
    expect(result.totalMeetings).toBe(1)
    expect(result.totalMeetingTokens).toBe(0)
    expect(result.totalMeetingCostUsd).toBe(0)
    expect(Number.isNaN(result.totalMeetingCostUsd)).toBe(false)
  })
})
