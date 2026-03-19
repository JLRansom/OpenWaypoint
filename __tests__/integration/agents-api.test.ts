/**
 * Integration tests for GET + POST /api/agents
 *
 * Tests call the route handler functions directly using synthetic NextRequest
 * objects, hitting the real (per-worker isolated) SQLite database.
 *
 * Design notes:
 *  - Each test seeds its own project so tests are fully independent.
 *  - We never assert on the exact agent IDs returned by GET because other
 *    tests in this file also seed agents; we only check structural shape
 *    and filtering correctness.
 *  - POST creates an agent — we verify both 2xx happy paths and 4xx error paths.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/agents/route'
import { addProject } from '@/lib/store'
import { makeTestProject } from '../helpers/test-utils'

// ─── Request builders ─────────────────────────────────────────────────────────

function postRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/agents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function getRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/agents')
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/agents', () => {
  let projectId: string

  beforeAll(() => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('creates an agent and returns 201 with the correct shape', async () => {
    const res = await POST(postRequest({ type: 'coder', projectId }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      type: 'coder',
      projectId,
      status: 'idle',
      prompt: '',
      events: [],
    })
    expect(typeof body.id).toBe('string')
    expect(typeof body.createdAt).toBe('number')
  })

  it('accepts all valid agent types', async () => {
    const validTypes = ['researcher', 'coder', 'writer', 'senior-coder', 'tester'] as const
    for (const type of validTypes) {
      const res = await POST(postRequest({ type, projectId }))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.type).toBe(type)
    }
  })

  // ── Validation errors ─────────────────────────────────────────────────────

  it('returns 400 when `type` is missing', async () => {
    const res = await POST(postRequest({ projectId }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 400 when `projectId` is missing', async () => {
    const res = await POST(postRequest({ type: 'coder' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns 400 for an invalid agentType enum value', async () => {
    const res = await POST(postRequest({ type: 'super-agent', projectId }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid agent type/i)
  })

  it('returns 404 when the referenced project does not exist', async () => {
    const res = await POST(postRequest({ type: 'coder', projectId: 'nonexistent-project-id' }))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })
})

describe('GET /api/agents', () => {
  // Seed a dedicated project so agents created here are isolatable
  let projectId: string

  beforeAll(async () => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id

    // Create a couple of agents for this project
    await POST(postRequest({ type: 'researcher', projectId }))
    await POST(postRequest({ type: 'tester', projectId }))
  })

  it('returns 200 with an array', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  it('includes agents we just created', async () => {
    const res = await GET()
    const body = await res.json()
    // The agents we seeded above must appear in the list
    const types = (body as { type: string }[]).map((a) => a.type)
    expect(types).toContain('researcher')
    expect(types).toContain('tester')
  })

  it('all returned agents have the expected shape', async () => {
    const res = await GET()
    const agents = (await res.json()) as Record<string, unknown>[]
    for (const agent of agents) {
      expect(typeof agent.id).toBe('string')
      expect(typeof agent.type).toBe('string')
      expect(typeof agent.status).toBe('string')
      expect(Array.isArray(agent.events)).toBe(true)
      expect(typeof agent.createdAt).toBe('number')
    }
  })

  it('returns an agent with projectId matching the project it was created for', async () => {
    const res = await GET()
    const agents = (await res.json()) as { type: string; projectId?: string }[]
    const ours = agents.filter((a) => a.projectId === projectId)
    // We created researcher + tester above, so at least 2 from this project
    expect(ours.length).toBeGreaterThanOrEqual(2)
  })
})
