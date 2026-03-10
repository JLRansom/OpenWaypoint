import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { Agent, AgentStats, TaskStatus, BoardType, TaskFile } from '@/lib/types'
import { getTask, getProject, getAllAgents, updateAgent, updateTask, getAgent, addTask, getFilesByTask } from '@/lib/store'
import { runAgent } from '@/lib/agent-runner'
import { dbAddTaskRun } from '@/lib/db/repositories/taskRunRepo'
import { mergeWorktreeBranch } from '@/lib/git-utils'

/** Maximum inline content size (bytes) — larger files are referenced by path only. */
const INLINE_FILE_MAX_BYTES = 100 * 1024

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
      'You are an expert QA engineer. ' +
      'Write comprehensive test cases for the implementation provided. ' +
      'Run the tests using available tools (bash, etc.). ' +
      'Report all failures with detail. ' +
      'End your response with exactly one of: "VERDICT: TESTS PASSED" or "VERDICT: TESTS FAILED". ' +
      'If tests failed, include a "## Test Failures" section listing each failure.'
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

  for (const file of files) {
    const absPath = path.join(process.cwd(), file.storagePath)
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
      const sizeLabel = formatBytes(file.sizeBytes)
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
    prompt += '\n\nWrite and run tests for this implementation.'
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
      costUsd: finalStats?.costUsd,
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
          // Merge the worktree branch into master (best-effort)
          if (directory) {
            try {
              await mergeWorktreeBranch(directory, task.title)
            } catch (err) {
              console.error('[agentService] Worktree merge failed (non-blocking):', err)
            }
          }

          // Parse any minor issues the senior coder flagged and log them as backlog tasks
          const minorMatch = output.match(/##\s*Minor Issues([\s\S]*?)(?=\n##|\s*$)/)
          if (minorMatch) {
            const items = minorMatch[1]
              .split(/\n[-*]\s+/)
              .map((s) => s.trim())
              .filter(Boolean)

            for (const item of items) {
              const title = item.length > 80 ? item.slice(0, 77) + '...' : item
              addTask({
                id: randomUUID(),
                projectId: task.projectId,
                title,
                description: `Auto-logged from senior review of "${task.title}":\n\n${item}`,
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
          updateTask(task.id, { status: 'done' })
        } else if (_testCycle < MAX_TEST_CYCLES) {
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
