import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { Agent, AgentStats, AgentType, TaskStatus, BoardType, TaskFile, MeetingAgentType, MEETING_AGENT_ORDER } from '@/lib/types'
import { getTask, getProject, getAllAgents, updateAgent, updateTask, getAgent, addTask, getFilesByTask, getMeeting, getMessagesByMeeting, updateMeeting, updateMeetingMessage, updateMeetingMessageSilent, broadcastNow, getTasksByProject } from '@/lib/store'
import { formatFileSize } from '@/lib/format-utils'
import { runAgent } from '@/lib/agent-runner'
import { getExecutor } from '@/lib/executors/registry'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { mergeWorktreeBranch } from '@/lib/git-utils'
import { calculateCost } from '@/lib/pricing'

/** Maximum inline content size (bytes) — larger files are referenced by path only. */
const INLINE_FILE_MAX_BYTES = 100 * 1024

/**
 * Merges a tag into a task's tag list without duplicates.
 * Safe to call concurrently — reads the latest task state each time.
 */
function addTagToTask(taskId: string, tag: string): void {
  const current = getTask(taskId)
  if (!current) return
  const existing = current.tags ?? []
  if (existing.includes(tag)) return
  updateTask(taskId, { tags: [...existing, tag] })
}

export type AssignRole = 'researcher' | 'coder' | 'senior-coder' | 'tester'

const MAX_REVIEW_CYCLES = 3
const MAX_TEST_CYCLES = 2

function getStatusForRole(role: AssignRole, boardType: BoardType): TaskStatus {
  if (boardType === 'research' && role === 'researcher') return 'in-progress'
  const defaults: Record<AssignRole, TaskStatus> = {
    researcher: 'planning',
    coder: 'in-progress',
    'senior-coder': 'review',
    tester: 'testing',
  }
  return defaults[role]
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
  if (role === 'tester') {
    return (
      'You are an expert QA engineer. Your job is to write real test cases for the ' +
      'implementation provided, run them, and ensure they pass. ' +
      'Follow this process: ' +
      '(1) Study the implementation carefully. ' +
      '(2) Write test files appropriate for the project stack ' +
      '(e.g. *.test.ts for TypeScript/Node, test_*.py for Python, *_test.go for Go). ' +
      "(3) Run the tests using the project's test command — check package.json scripts, " +
      'pytest.ini, Makefile, etc. (e.g. npm run test:run, pytest, go test ./...). ' +
      '(4) Fix any test infrastructure issues (missing imports, wrong paths, env setup) ' +
      'and re-run. ' +
      '(5) Do NOT fix implementation bugs yourself — report them clearly so the coder can fix them. ' +
      'End your response with exactly one of: "VERDICT: TESTS PASSED" or "VERDICT: TESTS FAILED". ' +
      'If tests failed, include a "## Test Failures" section detailing each failure and ' +
      'what it implies about the implementation.'
    )
  }
  return (
    'You are a senior software engineer performing code review. ' +
    'Evaluate the implementation for correctness, edge cases, and code quality. ' +
    'Be specific in your feedback. ' +
    'End your review with exactly one of: "VERDICT: APPROVED" or "VERDICT: CHANGES REQUESTED". ' +
    'If requesting changes, include a "## Changes Required" section listing specific items to fix. ' +
    'If you approve but notice minor issues, non-blocking improvements, or future cleanup tasks, ' +
    'include a "## Minor Issues" section listing each item as a bullet point. ' +
    'These will be logged as backlog items automatically.'
  )
}

/**
 * Build the file-context section appended to every agent prompt.
 *
 * - Text/code files ≤ 100 KB are included inline so the agent can read them
 *   without any extra tool calls.
 * - Larger text files and all binary files (images, PDFs) are referenced by
 *   absolute path so a local CLI executor can access them via shell tools.
 */
function buildFileContext(files: TaskFile[]): string {
  if (files.length === 0) return ''

  const lines: string[] = ['\n\n## Attached Files\n']

  const uploadsRoot = path.join(process.cwd(), 'data', 'uploads')

  for (const file of files) {
    const absPath = path.join(process.cwd(), file.storagePath)

    // Path traversal guard — same check used by the content/delete routes
    if (!absPath.startsWith(uploadsRoot + path.sep)) {
      lines.push(`- \`${file.filename}\` (${file.mimeType}) — [file reference unavailable]\n`)
      continue
    }

    const isText =
      file.mimeType.startsWith('text/') ||
      file.mimeType === 'application/json' ||
      file.mimeType === 'application/xml'

    if (isText && file.sizeBytes <= INLINE_FILE_MAX_BYTES) {
      try {
        const content = fs.readFileSync(absPath, 'utf8')
        // Detect a rough language hint from MIME type for fenced code blocks
        const lang = mimeToLang(file.mimeType)
        lines.push(`### ${file.filename}\n\`\`\`${lang}\n${content}\n\`\`\`\n`)
      } catch {
        // Fallback to path reference if file can't be read
        lines.push(`- \`${file.filename}\` (${file.mimeType}) — path: ${absPath}\n`)
      }
    } else {
      const sizeLabel = formatFileSize(file.sizeBytes)
      lines.push(`- \`${file.filename}\` (${file.mimeType}, ${sizeLabel}) — path: ${absPath}\n`)
    }
  }

  return lines.join('\n')
}

function mimeToLang(mime: string): string {
  const MAP: Record<string, string> = {
    'text/javascript': 'javascript',
    'text/typescript': 'typescript',
    'application/json': 'json',
    'text/html': 'html',
    'text/css': 'css',
    'text/markdown': 'markdown',
    'text/csv': 'csv',
    'application/xml': 'xml',
    'text/xml': 'xml',
  }
  return MAP[mime] ?? ''
}


function buildUserPrompt(
  role: AssignRole,
  task: NonNullable<ReturnType<typeof getTask>>,
  directory?: string
): string {
  const dirContext = directory
    ? `\n\n## Working Directory\n\`${directory}\` — all file references should be relative to this path.`
    : ''
  const header = `# Task: ${task.title}\n\n${task.description}${dirContext}`

  // Fetch any files attached to this task and build context section
  const attachedFiles = getFilesByTask(task.id)
  const fileContext = buildFileContext(attachedFiles)

  if (role === 'researcher') {
    return `${header}${fileContext}\n\nProduce a technical specification and implementation plan for this task.`
  }

  if (role === 'coder') {
    let prompt = header + fileContext
    if (task.researcherOutput) {
      prompt += `\n\n## Research & Specification\n\n${task.researcherOutput}`
    }
    if (task.reviewNotes) {
      prompt += `\n\n## Review Feedback (Changes Required)\n\n${task.reviewNotes}\n\nPlease address all of the above review feedback in your implementation.`
    }
    if (task.testerOutput) {
      prompt += `\n\n## Test Failures to Fix\n\n${task.testerOutput}\n\nPlease fix all failing tests.`
    }
    prompt += '\n\nImplement this task.'
    return prompt
  }

  if (role === 'tester') {
    let prompt = header + fileContext
    if (task.coderOutput) prompt += `\n\n## Implementation\n\n${task.coderOutput}`
    if (task.testerOutput) prompt += `\n\n## Previous Test Failures (retry)\n\n${task.testerOutput}`
    prompt +=
      "\n\nWrite test cases for this implementation, run them using the project's test runner, " +
      'and report whether they pass or fail.'
    return prompt
  }

  // senior-coder
  let prompt = header + fileContext
  if (task.researcherOutput) {
    prompt += `\n\n## Research & Specification\n\n${task.researcherOutput}`
  }
  if (task.coderOutput) {
    prompt += `\n\n## Implementation\n\n${task.coderOutput}`
  }
  prompt += '\n\nReview the implementation above.'
  return prompt
}

export async function assignAgentToTask(
  taskId: string,
  role: AssignRole,
  _cycle = 0,
  _testCycle = 0
): Promise<Agent | { error: string }> {
  const task = getTask(taskId)
  if (!task) return { error: 'task not found' }

  const project = task.projectId ? getProject(task.projectId) : null
  const directory = project?.directory || undefined
  const boardType: BoardType = project?.boardType ?? 'coding'

  const idleAgent = getAllAgents().find(
    (a) => a.type === role && a.status === 'idle' && a.projectId === task.projectId
  )

  if (!idleAgent) {
    const roleLabel = role === 'senior-coder' ? 'senior coder' : role
    return { error: `No idle ${roleLabel} assigned to this project. Spawn one from the Dashboard.` }
  }

  const prompt = buildUserPrompt(role, task, directory)
  const systemPrompt = buildSystemPrompt(role)

  updateAgent(idleAgent.id, {
    prompt,
    status: 'queued',
    taskId: task.id,
    taskStartedAt: Date.now(),
    events: [],
    systemPromptOverride: systemPrompt,
  })

  updateTask(task.id, {
    status: getStatusForRole(role, boardType),
    activeAgentId: idleAgent.id,
  })

  const agentToRun = getAgent(idleAgent.id)!
  const startedAt = Date.now()
  const rawLines: string[] = []
  // `finalStats` is captured via the onStats callback which is called
  // synchronously from within executor.run() before its Promise resolves.
  // By the time the .then() handler below executes, finalStats is guaranteed
  // to hold the last value emitted — no race condition.
  let finalStats: AgentStats | undefined

  runAgent(
    agentToRun,
    (line) => rawLines.push(line),
    (stats) => { finalStats = stats },
  ).then(async () => {
    const completed = getAgent(idleAgent.id)
    if (!completed) return

    const output = completed.events.map((e) => e.text).join('')

    // If the executor didn't populate costUsd (e.g. CLI didn't emit cost_usd),
    // compute it server-side from the pricing table using token counts + model.
    // Pass cache token counts so the correct tiered rates are applied.
    const computedCostUsd =
      finalStats?.costUsd ??
      (finalStats?.inputTokens != null &&
      finalStats?.outputTokens != null &&
      finalStats?.model
        ? calculateCost(
            finalStats.inputTokens,
            finalStats.outputTokens,
            finalStats.model,
            finalStats.cacheReadTokens ?? 0,
            finalStats.cacheWriteTokens ?? 0,
          )
        : undefined)

    dbAddTaskRun({
      id: randomUUID(),
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      projectName: project?.name ?? '',
      agentId: idleAgent.id,
      role,
      status: completed.status as 'done' | 'failed',
      output,
      error: completed.error,
      rawLog: rawLines.join('\n'),
      startedAt,
      completedAt: completed.completedAt ?? Date.now(),
      inputTokens: finalStats?.inputTokens,
      outputTokens: finalStats?.outputTokens,
      // totalTokens is not a stored column — it is derived from inputTokens +
      // outputTokens in rowToTaskRun() on read. Passing it here is harmless
      // (dbAddTaskRun ignores it) but is included for type completeness.
      totalTokens: finalStats?.totalTokens,
      numTurns: finalStats?.numTurns,
      costUsd: computedCostUsd,
      model: finalStats?.model,
    })

    if (role === 'researcher') {
      updateTask(task.id, { researcherOutput: output })
      if (completed.status === 'done') {
        if (boardType === 'research') {
          updateTask(task.id, { status: 'done' })
        } else {
          assignAgentToTask(taskId, 'coder', 0, 0).catch(console.error)
        }
      }
    } else if (role === 'coder') {
      updateTask(task.id, { coderOutput: output })
      if (completed.status === 'done') {
        assignAgentToTask(taskId, 'senior-coder', _cycle, _testCycle).catch(console.error)
      }
    } else if (role === 'senior-coder') {
      // Only process verdict if the agent actually succeeded — a failed agent
      // won't have emitted a proper VERDICT line, so we'd misread the output.
      if (completed.status === 'done') {
        if (output.includes('VERDICT: APPROVED')) {
          // Stamp the card with an "approved" tag
          addTagToTask(task.id, 'approved')

          // Merge the worktree branch into master (best-effort)
          if (directory) {
            try {
              await mergeWorktreeBranch(directory, task.title)
            } catch (err) {
              console.error('[agentService] Worktree merge failed (non-blocking):', err)
            }
          }

          // Parse any minor issues the senior coder flagged and log them as a single backlog task
          const minorMatch = output.match(/##\s*Minor Issues([\s\S]*?)(?=\n##|\s*$)/)
          if (minorMatch) {
            const items = minorMatch[1]
              .split(/\n[-*]\s+/)
              .map((s) => s.trim())
              .filter(Boolean)

            if (items.length > 0) {
              const title = `Minor issues from review of "${task.title}"`
              const bulletList = items.map((item) => `- ${item}`).join('\n')
              addTask({
                id: randomUUID(),
                projectId: task.projectId,
                title: title.length > 80 ? title.slice(0, 77) + '...' : title,
                description: `Auto-logged from senior review of "${task.title}":\n\n${bulletList}`,
                status: 'backlog',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              })
            }
          }

          if (boardType === 'coding') {
            // If no idle tester is available, fall back to done rather than
            // leaving the task permanently stuck in review.
            const result = await assignAgentToTask(taskId, 'tester', _cycle, 0)
            if ('error' in result) {
              updateTask(task.id, { status: 'done' })
            }
          } else {
            updateTask(task.id, { status: 'done' })
          }
        } else {
          // Stamp with "changes-requested" tag
          addTagToTask(task.id, 'changes-requested')
          const changesMatch = output.match(/##\s*Changes Required([\s\S]*)/)
          const reviewNotes = changesMatch ? changesMatch[1].trim() : output
          updateTask(task.id, { status: 'changes-requested', reviewNotes })
          if (_cycle < MAX_REVIEW_CYCLES) {
            assignAgentToTask(taskId, 'coder', _cycle + 1, _testCycle).catch(console.error)
          }
        }
      }
      // If agent failed, task stays in 'review' — user can manually re-assign.
    } else if (role === 'tester') {
      updateTask(task.id, { testerOutput: output })
      // Only process verdict if the agent actually succeeded — a failed agent
      // won't have emitted a proper VERDICT line, so we'd misread the output.
      if (completed.status === 'done') {
        if (output.includes('VERDICT: TESTS PASSED')) {
          addTagToTask(task.id, 'tests-passed')
          updateTask(task.id, { status: 'done' })
        } else if (_testCycle < MAX_TEST_CYCLES) {
          addTagToTask(task.id, 'tests-failed')
          // If no idle coder is available for retry, leave the task in testing
          // so the user can trigger a manual retry once a coder is free.
          const result = await assignAgentToTask(taskId, 'coder', _cycle, _testCycle + 1)
          if ('error' in result) {
            console.error('Tester retry: no idle coder available —', result.error)
          }
        }
        // else _testCycle >= MAX_TEST_CYCLES — stay in testing, pipeline stops gracefully
      }
      // If agent failed, task stays in testing — user can manually re-assign
    }

    // Bug fix: clear activeAgentId on the task once this agent is done,
    // but only if it hasn't already been updated to point at a new agent
    // by a pipeline continuation step (e.g. researcher→coder hand-off).
    const currentTask = getTask(task.id)
    if (currentTask && currentTask.activeAgentId === idleAgent.id) {
      updateTask(task.id, { activeAgentId: undefined })
    }

    updateAgent(idleAgent.id, {
      status: 'idle',
      taskId: undefined,
      taskStartedAt: undefined,
      prompt: '',
      // Clear stale stats so the next task starts with a blank slate rather
      // than showing token counts from the previous run on the card.
      stats: undefined,
    })
  }).catch(console.error)

  return agentToRun
}

// ---------------------------------------------------------------------------
// Meeting orchestration
// ---------------------------------------------------------------------------

function buildMeetingSystemPrompt(agentType: MeetingAgentType): string {
  const base =
    'You are participating in a team meeting. ' +
    'Keep your contribution focused, constructive, and between 100-300 words. ' +
    'Do not use markdown headers. Write in a conversational but professional tone.'

  const roleContext: Record<MeetingAgentType, string> = {
    writer:
      'You are the writer on an AI agent development team. ' +
      'Analyze the project\'s current state — its goals, active tasks, recent progress, and gaps — ' +
      'then propose a creative, actionable idea worth discussing with the team. ' +
      'Frame it clearly: what the idea is, why it matters, and what impact it would have. ' +
      'Do NOT simply repeat the project description. Keep it 100-300 words.',
    researcher:
      `${base} You are the researcher — evaluate from an analytics and data perspective. ` +
      'How would we measure success? What data supports this direction? How does it help revenue?',
    coder:
      `${base} You are the coder — assess technical feasibility. ` +
      'What is the implementation approach? What are the technical risks and dependencies?',
    'senior-coder':
      `${base} You are the senior engineer — evaluate architecture and stability. ` +
      'Will this scale? Does it fit existing architecture? What technical debt might it introduce?',
    tester:
      `${base} You are the QA engineer — consider quality assurance implications. ` +
      'How do we test this? What edge cases and failure modes should we watch for?',
  }

  return roleContext[agentType]
}

function buildMeetingUserPrompt(
  agentType: MeetingAgentType,
  topic: string | null,
  priorContext: string,
  projectName?: string,
  projectDescription?: string,
  taskSummaries?: string,
): string {
  let prompt: string

  if (agentType === 'writer') {
    // Writer analyzes the project and proposes an idea autonomously
    prompt = '# Your Task\n\nAnalyze this project and propose an idea for the team to discuss.'
    if (projectName) {
      prompt += `\n\n## Project: ${projectName}`
      if (projectDescription) prompt += `\n${projectDescription}`
    }
    if (taskSummaries) {
      prompt += `\n\n## Current Tasks\n${taskSummaries}`
    }
    prompt += '\n\nPropose an interesting, actionable idea based on the project\'s current state. Keep it 100-300 words.'
  } else {
    // Other agents discuss the topic the writer proposed
    prompt = `# Meeting Topic\n\n${topic ?? 'A project improvement idea'}`
    if (projectName) {
      prompt += `\n\n## Project Context\nProject: ${projectName}`
      if (projectDescription) prompt += `\nDescription: ${projectDescription}`
    }
    if (priorContext) {
      prompt += `\n\n## Prior Discussion\n${priorContext}`
    }
    prompt += `\n\nShare your perspective as the ${agentType}. Keep it 100-300 words.`
  }

  return prompt
}

/**
 * Extract a short topic summary from the writer's output.
 * Takes the first sentence (up to first period/newline) truncated at 120 chars.
 */
function extractTopicFromWriterOutput(output: string): string {
  const clean = output.trim()
  const firstSentenceEnd = clean.search(/[.!\n]/)
  const candidate = firstSentenceEnd > 0 ? clean.slice(0, firstSentenceEnd) : clean
  return candidate.trim().slice(0, 120) || 'Auto-generated meeting'
}

/**
 * Run a full meeting: each agent in MEETING_AGENT_ORDER speaks sequentially.
 * Uses the executor directly (not the idle agent pool) so meetings don't
 * consume project agents. Streams each response via SSE.
 */
export async function runMeeting(meetingId: string): Promise<void> {
  const meeting = getMeeting(meetingId)
  if (!meeting) return

  const project = getProject(meeting.projectId)
  const workingDirectory = project?.directory || undefined
  const executor = getExecutor(project?.executorConfig ?? undefined)

  // Build task summaries for the writer's project analysis
  const tasks = project ? getTasksByProject(project.id) : []
  const recentTasks = tasks.slice(0, 20)
  const taskSummaries = recentTasks.length > 0
    ? recentTasks.map((t) => `- [${t.status}] ${t.title}`).join('\n')
    : '(no tasks yet)'

  const messages = getMessagesByMeeting(meetingId)
  let priorContext = ''
  let meetingTopic = meeting.topic // will be updated after writer speaks

  for (const agentType of MEETING_AGENT_ORDER) {
    const msgRow = messages.find((m) => m.agentType === agentType)
    if (!msgRow) continue

    // Update meeting + message status
    const meetingStatus = agentType === 'writer' ? 'writer-speaking' : 'discussion'
    updateMeeting(meetingId, { status: meetingStatus, updatedAt: Date.now() })
    updateMeetingMessage(msgRow.id, { status: 'speaking', startedAt: Date.now() })

    const systemPrompt = buildMeetingSystemPrompt(agentType)
    const userPrompt = buildMeetingUserPrompt(
      agentType,
      meetingTopic,
      priorContext,
      project?.name,
      project?.description,
      agentType === 'writer' ? taskSummaries : undefined,
    )

    // Temporary agent object for the executor
    const tempAgent: Agent = {
      id: randomUUID(),
      type: agentType as AgentType,
      prompt: userPrompt,
      status: 'running',
      events: [],
      createdAt: Date.now(),
      projectId: meeting.projectId,
      systemPromptOverride: systemPrompt,
    }

    let accumulated = ''
    let lastBroadcastAt = 0
    let finalStats: AgentStats | undefined
    const controller = new AbortController()

    try {
      await executor.run({
        agent: tempAgent,
        workingDirectory,
        onChunk: (chunk) => {
          accumulated += chunk.text
          // DB write on every chunk (crash recovery)
          updateMeetingMessageSilent(msgRow.id, { content: accumulated })
          // Throttle SSE broadcasts to ~200ms
          const now = Date.now()
          if (now - lastBroadcastAt > 200) {
            broadcastNow()
            lastBroadcastAt = now
          }
        },
        onStats: (stats) => { finalStats = stats },
        signal: controller.signal,
      })

      // Compute cost — prefer stats-reported, fall back to pricing table.
      // Pass cache token counts so the correct tiered rates are applied.
      const computedCost =
        finalStats?.costUsd ??
        (finalStats?.inputTokens != null && finalStats?.outputTokens != null && finalStats?.model
          ? calculateCost(
              finalStats.inputTokens,
              finalStats.outputTokens,
              finalStats.model,
              finalStats.cacheReadTokens ?? 0,
              finalStats.cacheWriteTokens ?? 0,
            )
          : undefined)

      updateMeetingMessage(msgRow.id, {
        content: accumulated,
        status: 'done',
        completedAt: Date.now(),
        inputTokens: finalStats?.inputTokens,
        outputTokens: finalStats?.outputTokens,
        costUsd: computedCost,
        model: finalStats?.model,
      })
    } catch (err) {
      updateMeetingMessage(msgRow.id, {
        content: accumulated || `[Error: ${err instanceof Error ? err.message : String(err)}]`,
        status: 'done',
        completedAt: Date.now(),
        inputTokens: finalStats?.inputTokens,
        outputTokens: finalStats?.outputTokens,
        costUsd: finalStats?.costUsd,
        model: finalStats?.model,
      })
    }

    // After the writer speaks, auto-set the meeting topic from their output
    if (agentType === 'writer' && accumulated) {
      meetingTopic = extractTopicFromWriterOutput(accumulated)
      updateMeeting(meetingId, { topic: meetingTopic, updatedAt: Date.now() })
    }

    priorContext += `\n\n### ${agentType}\n${accumulated}`
  }

  updateMeeting(meetingId, { status: 'concluded', updatedAt: Date.now() })
}
