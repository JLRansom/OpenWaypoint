/**
 * Unit tests for the exported pure helpers in lib/services/agentService.ts:
 *   - buildSystemPrompt(role)
 *   - buildUserPrompt(role, task, directory?)
 *   - Double-scheduling guard in assignAgentToTask()
 *
 * Design notes:
 *  - buildSystemPrompt and buildUserPrompt are pure-ish functions (buildUserPrompt
 *    calls getFilesByTask internally; for tasks not in the DB it returns [] which
 *    is fine for prompt-content tests).
 *  - The double-scheduling guard is tested by seeding a task with a queued/running
 *    agent; assignAgentToTask returns early before touching runAgent so no
 *    real agent execution occurs.
 *  - We do NOT test the full runAgent pipeline here — that requires a live executor
 *    and is out of scope for unit tests.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'crypto'
import { buildSystemPrompt, buildUserPrompt, AssignRole, assignAgentToTask } from '@/lib/services/agentService'
import { addProject, addTask, addAgent } from '@/lib/store'
import { makeTestProject, makeTestTask, makeTestAgent } from '../helpers/test-utils'

// ─── buildSystemPrompt ────────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
  it('returns a non-empty string for every valid role', () => {
    const roles: AssignRole[] = ['researcher', 'coder', 'senior-coder', 'tester']
    for (const role of roles) {
      const prompt = buildSystemPrompt(role)
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
    }
  })

  it('researcher prompt mentions research/analysis intent', () => {
    const prompt = buildSystemPrompt('researcher')
    // Should mention planning or analysis
    expect(prompt.toLowerCase()).toMatch(/research|analys|planning|specification/)
  })

  it('coder prompt identifies as a software engineer', () => {
    const prompt = buildSystemPrompt('coder')
    expect(prompt.toLowerCase()).toMatch(/software engineer|implement|code/)
  })

  it('senior-coder prompt asks for a code review verdict', () => {
    const prompt = buildSystemPrompt('senior-coder')
    expect(prompt).toMatch(/VERDICT/)
    expect(prompt).toMatch(/APPROVED|CHANGES REQUESTED/)
  })

  it('tester prompt asks for a test verdict', () => {
    const prompt = buildSystemPrompt('tester')
    expect(prompt).toMatch(/VERDICT/)
    expect(prompt).toMatch(/TESTS PASSED|TESTS FAILED/)
  })

  it('returns distinct content for each role', () => {
    const roles: AssignRole[] = ['researcher', 'coder', 'senior-coder', 'tester']
    const prompts = roles.map(buildSystemPrompt)
    const unique = new Set(prompts)
    expect(unique.size).toBe(roles.length)
  })
})

// ─── buildUserPrompt ──────────────────────────────────────────────────────────

describe('buildUserPrompt', () => {
  // We build task objects without persisting them to DB — getFilesByTask returns
  // [] for an unknown task ID which is the expected behaviour here.
  const baseTask = makeTestTask(randomUUID(), {
    title: 'Refactor auth module',
    description: 'Clean up the legacy auth code.',
    researcherOutput: 'Spec: use JWT, remove sessions.',
    coderOutput: 'Implementation: see auth.ts.',
    reviewNotes: 'Missing error handling on token expiry.',
    testerOutput: 'Tests failed: auth_test.ts line 42.',
  })

  it('includes the task title and description in all roles', () => {
    const roles: AssignRole[] = ['researcher', 'coder', 'senior-coder', 'tester']
    for (const role of roles) {
      const prompt = buildUserPrompt(role, baseTask)
      expect(prompt).toContain(baseTask.title)
      expect(prompt).toContain(baseTask.description)
    }
  })

  it('includes the working directory context when provided', () => {
    const prompt = buildUserPrompt('researcher', baseTask, '/workspace/myproject')
    expect(prompt).toContain('/workspace/myproject')
    expect(prompt).toMatch(/Working Directory/i)
  })

  it('omits the working directory section when not provided', () => {
    const prompt = buildUserPrompt('researcher', baseTask)
    expect(prompt).not.toMatch(/Working Directory/i)
  })

  it('researcher prompt ends with a specification request', () => {
    const prompt = buildUserPrompt('researcher', baseTask)
    expect(prompt).toMatch(/technical specification|implementation plan/i)
  })

  it('coder prompt includes researcherOutput when present', () => {
    const prompt = buildUserPrompt('coder', baseTask)
    expect(prompt).toContain(baseTask.researcherOutput!)
  })

  it('coder prompt includes reviewNotes when present (changes-requested cycle)', () => {
    const prompt = buildUserPrompt('coder', baseTask)
    expect(prompt).toContain(baseTask.reviewNotes!)
  })

  it('coder prompt includes testerOutput when present (test-failure cycle)', () => {
    const prompt = buildUserPrompt('coder', baseTask)
    expect(prompt).toContain(baseTask.testerOutput!)
  })

  it('senior-coder prompt includes coderOutput when present', () => {
    const prompt = buildUserPrompt('senior-coder', baseTask)
    expect(prompt).toContain(baseTask.coderOutput!)
  })

  it('tester prompt includes coderOutput when present', () => {
    const prompt = buildUserPrompt('tester', baseTask)
    expect(prompt).toContain(baseTask.coderOutput!)
  })
})

// ─── Double-scheduling guard (assignAgentToTask) ──────────────────────────────

describe('assignAgentToTask — double-scheduling guard', () => {
  let projectId: string
  let taskId: string

  beforeAll(() => {
    const project = makeTestProject()
    addProject(project)
    projectId = project.id

    // Create a task and an agent that is already marked as 'queued'
    const activeAgent = makeTestAgent({ type: 'coder', status: 'queued', projectId })
    addAgent(activeAgent)

    const task = makeTestTask(projectId, {
      status: 'in-progress',
      activeAgentId: activeAgent.id,
    })
    addTask(task)
    taskId = task.id
  })

  it('returns an error (not throws) when the task already has a queued agent', async () => {
    const result = await assignAgentToTask(taskId, 'coder')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/active/i)
  })

  it('returns an error when the task already has a running agent', async () => {
    const project = makeTestProject()
    addProject(project)

    const runningAgent = makeTestAgent({ type: 'researcher', status: 'running', projectId: project.id })
    addAgent(runningAgent)

    const task = makeTestTask(project.id, {
      status: 'planning',
      activeAgentId: runningAgent.id,
    })
    addTask(task)

    const result = await assignAgentToTask(task.id, 'researcher')
    expect(result).toHaveProperty('error')
    expect((result as { error: string }).error).toMatch(/active/i)
  })

  it('does not block when the task has a done (inactive) agent as activeAgentId', async () => {
    // A 'done' agent is no longer active — the guard should pass through
    // (it will fail for a different reason — no idle agent in project — which is fine)
    const project = makeTestProject()
    addProject(project)

    const doneAgent = makeTestAgent({ type: 'coder', status: 'done', projectId: project.id })
    addAgent(doneAgent)

    const task = makeTestTask(project.id, {
      status: 'in-progress',
      activeAgentId: doneAgent.id,
    })
    addTask(task)

    const result = await assignAgentToTask(task.id, 'coder')
    // Should NOT return the "already has an active agent" error
    if ('error' in result) {
      expect(result.error).not.toMatch(/active/i)
    }
  })
})
