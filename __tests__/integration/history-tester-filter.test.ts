/**
 * Integration tests confirming the history endpoint supports role=tester
 * (and role=writer) filters — previously the UI omitted these options.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/runs/route'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { makeTestTaskRun } from '../helpers/test-utils'
import { randomUUID } from 'crypto'

function runsRequest(queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/runs${queryString}`)
}

describe('GET /api/runs — role filter includes tester and writer', () => {
  const projectId = randomUUID()

  beforeEach(() => {
    dbAddTaskRun(makeTestTaskRun(projectId, { role: 'researcher' }))
    dbAddTaskRun(makeTestTaskRun(projectId, { role: 'coder' }))
    dbAddTaskRun(makeTestTaskRun(projectId, { role: 'senior-coder' }))
    dbAddTaskRun(makeTestTaskRun(projectId, { role: 'tester' }))
    dbAddTaskRun(makeTestTaskRun(projectId, { role: 'tester' }))
    dbAddTaskRun(makeTestTaskRun(projectId, { role: 'writer' }))
  })

  it('returns all runs when no role filter is applied', async () => {
    const res = await GET(runsRequest())
    const body = await res.json()
    expect(body.total).toBeGreaterThanOrEqual(6)
  })

  it('filters to tester runs only', async () => {
    const res = await GET(runsRequest('?role=tester&limit=100'))
    const body = await res.json()
    expect(body.runs.every((r: { role: string }) => r.role === 'tester')).toBe(true)
    expect(body.runs.length).toBeGreaterThanOrEqual(2)
  })

  it('filters to writer runs only', async () => {
    const res = await GET(runsRequest('?role=writer&limit=100'))
    const body = await res.json()
    expect(body.runs.every((r: { role: string }) => r.role === 'writer')).toBe(true)
    expect(body.runs.length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty when filtering by a non-existent role', async () => {
    const res = await GET(runsRequest('?role=nonexistent'))
    const body = await res.json()
    expect(body.runs).toHaveLength(0)
  })
})
