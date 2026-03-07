import { NextRequest, NextResponse } from 'next/server'
import { TaskStatus } from '@/lib/types'
import { getTask, updateTask, getAgent, getProject, getAllAgents, updateAgent } from '@/lib/store'
import { runAgent } from '@/lib/agent-runner'

type AssignRole = 'researcher' | 'coder' | 'senior-coder'

const STATUS_FOR_ROLE: Record<AssignRole, TaskStatus> = {
  researcher: 'planning',
  coder: 'in-progress',
  'senior-coder': 'review',
}

function buildSystemPrompt(role: AssignRole): string {
  if (role === 'researcher') {
    return (
      'You are a research analyst planning a software task. ' +
      'Analyze the task, break it down into clear implementation steps, ' +
      'identify potential challenges, and produce a concise technical specification. ' +
      'Be thorough but focused — the coder will implement directly from your output.'
    )
  }
  if (role === 'coder') {
    return (
      'You are an expert software engineer. ' +
      'Implement the task according to the provided specification. ' +
      'Write clean, well-structured code. Explain your design decisions. ' +
      'Handle edge cases. Prefer clarity over cleverness.'
    )
  }
  return (
    'You are a senior software engineer performing code review. ' +
    'Evaluate the implementation for correctness, edge cases, and code quality. ' +
    'Be specific in your feedback. ' +
    'End your review with exactly one of: "VERDICT: APPROVED" or "VERDICT: CHANGES REQUESTED". ' +
    'If requesting changes, include a "## Changes Required" section listing specific items to fix.'
  )
}

function buildUserPrompt(role: AssignRole, task: NonNullable<ReturnType<typeof getTask>>, directory?: string): string {
  const dirContext = directory
    ? `\n\n## Working Directory\n\`${directory}\` — all file references should be relative to this path.`
    : ''
  const header = `# Task: ${task.title}\n\n${task.description}${dirContext}`

  if (role === 'researcher') {
    return `${header}\n\nProduce a technical specification and implementation plan for this task.`
  }

  if (role === 'coder') {
    let prompt = header
    if (task.researcherOutput) {
      prompt += `\n\n## Research & Specification\n\n${task.researcherOutput}`
    }
    if (task.reviewNotes) {
      prompt += `\n\n## Review Feedback (Changes Required)\n\n${task.reviewNotes}\n\nPlease address all of the above review feedback in your implementation.`
    }
    prompt += '\n\nImplement this task.'
    return prompt
  }

  // senior-coder
  let prompt = header
  if (task.researcherOutput) {
    prompt += `\n\n## Research & Specification\n\n${task.researcherOutput}`
  }
  if (task.coderOutput) {
    prompt += `\n\n## Implementation\n\n${task.coderOutput}`
  }
  prompt += '\n\nReview the implementation above.'
  return prompt
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(id)
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 })

  const project = task.projectId ? getProject(task.projectId) : null
  const directory = project?.directory || undefined

  const body = await req.json()
  const { role } = body as { role: AssignRole }

  const validRoles: AssignRole[] = ['researcher', 'coder', 'senior-coder']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'invalid role' }, { status: 400 })
  }

  // Find an idle agent of the right type assigned to this project
  const idleAgent = getAllAgents().find(
    (a) => a.type === role && a.status === 'idle' && a.projectId === task.projectId
  )

  if (!idleAgent) {
    const roleLabel = role === 'senior-coder' ? 'senior coder' : role
    return NextResponse.json(
      { error: `No idle ${roleLabel} assigned to this project. Spawn one from the Dashboard.` },
      { status: 409 }
    )
  }

  const prompt = buildUserPrompt(role, task, directory)
  const systemPrompt = buildSystemPrompt(role)

  // Delegate task to idle agent
  updateAgent(idleAgent.id, {
    prompt,
    status: 'queued',
    taskId: task.id,
    events: [],
    systemPromptOverride: systemPrompt,
  })

  updateTask(task.id, {
    status: STATUS_FOR_ROLE[role],
    activeAgentId: idleAgent.id,
  })

  const agentToRun = getAgent(idleAgent.id)!

  runAgent(agentToRun).then(() => {
    const completed = getAgent(idleAgent.id)
    if (!completed) return

    const output = completed.events.map((e) => e.text).join('')

    if (role === 'researcher') {
      updateTask(task.id, { researcherOutput: output })
    } else if (role === 'coder') {
      updateTask(task.id, { coderOutput: output })
    } else if (role === 'senior-coder') {
      if (output.includes('VERDICT: APPROVED')) {
        updateTask(task.id, { status: 'done' })
      } else {
        const changesMatch = output.match(/##\s*Changes Required([\s\S]*)/)
        const reviewNotes = changesMatch ? changesMatch[1].trim() : output
        updateTask(task.id, { status: 'changes-requested', reviewNotes })
      }
    }

    // Reset agent to idle — ready for next task
    updateAgent(idleAgent.id, {
      status: 'idle',
      taskId: undefined,
      prompt: '',
    })
  }).catch(console.error)

  return NextResponse.json(agentToRun, { status: 200 })
}
