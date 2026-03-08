import type { Agent } from '@/lib/types'
import { updateAgent, appendEvent, getProject } from '@/lib/store'
import { getExecutor } from '@/lib/executors/registry'

const runControllers = new Map<string, AbortController>()

export function cancelAgent(agentId: string): void {
  runControllers.get(agentId)?.abort()
}

export async function runAgent(agent: Agent): Promise<void> {
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
      signal: controller.signal,
    })
    updateAgent(agent.id, { status: 'done', completedAt: Date.now() })
  } catch (err) {
    const isCancelled = err instanceof Error && err.name === 'AbortError'
    updateAgent(agent.id, {
      status: 'failed',
      error: isCancelled ? 'Cancelled by user' : (err instanceof Error ? err.message : String(err)),
      completedAt: Date.now(),
    })
  } finally {
    runControllers.delete(agent.id)
  }
}
