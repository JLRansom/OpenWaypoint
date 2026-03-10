import type { Agent, AgentStats } from '@/lib/types'
import { updateAgent, appendEvent, getProject } from '@/lib/store'
import { getExecutor } from '@/lib/executors/registry'

const runControllers = new Map<string, AbortController>()

export function cancelAgent(agentId: string): void {
  runControllers.get(agentId)?.abort()
}

/**
 * Classify an error into a human-readable reason + recovery suggestion.
 */
function classifyError(err: unknown): { reason: string; recovery: string } {
  const msg = err instanceof Error ? err.message : String(err)

  if (err instanceof Error && err.name === 'AbortError') {
    return {
      reason: 'Cancelled by user',
      recovery: 'Re-assign the agent to retry.',
    }
  }
  if (msg.includes('ENOENT') || msg.includes('not found')) {
    return {
      reason: 'Claude CLI binary not found',
      recovery: 'Ensure `claude` is installed and in PATH.',
    }
  }
  if (
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  ) {
    return {
      reason: 'Network/API connection failed',
      recovery: 'Check internet connection and API credentials, then re-assign.',
    }
  }
  if (msg.includes('rate limit') || msg.includes('429')) {
    return {
      reason: 'API rate limit exceeded',
      recovery: 'Wait a few minutes, then re-assign the agent.',
    }
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return {
      reason: 'Execution timed out',
      recovery:
        'The task may be too large. Break it down or increase timeout, then re-assign.',
    }
  }
  if (msg.includes('non-zero exit code')) {
    return {
      reason: 'Claude CLI exited with error',
      recovery: 'Check agent logs for details. Re-assign to retry.',
    }
  }
  return {
    reason: msg,
    recovery: 'Check agent logs for details. Re-assign to retry.',
  }
}

export async function runAgent(
  agent: Agent,
  onRawLine?: (line: string) => void,
  onStats?: (stats: AgentStats) => void,
): Promise<void> {
  const controller = new AbortController()
  runControllers.set(agent.id, controller)
  updateAgent(agent.id, { status: 'running' })

  const project = agent.projectId ? getProject(agent.projectId) : undefined
  const workingDirectory = project?.directory || undefined
  const executor = getExecutor(project?.executorConfig)

  try {
    await executor.run({
      agent,
      workingDirectory,
      onChunk: (chunk) => appendEvent(agent.id, { timestamp: chunk.timestamp, text: chunk.text }),
      onRawLine,
      onStats: (stats) => {
        // Persist stats to DB so SSE broadcasts include them.
        updateAgent(agent.id, { stats })
        onStats?.(stats)
      },
      signal: controller.signal,
    })
    updateAgent(agent.id, { status: 'done', completedAt: Date.now() })
  } catch (err) {
    const { reason, recovery } = classifyError(err)
    updateAgent(agent.id, {
      status: 'failed',
      error: `${reason} — ${recovery}`,
      completedAt: Date.now(),
    })
  } finally {
    runControllers.delete(agent.id)
  }
}
