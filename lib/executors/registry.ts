import type { Executor, ExecutorConfig, ExecutorType } from './types'
import { LocalClaudeCliExecutor } from './local'

const cache = new Map<string, Executor>()

export function getExecutor(config?: Partial<ExecutorConfig>): Executor {
  const type: ExecutorType = config?.type ?? 'local-cli'
  const key = JSON.stringify({ type, path: config?.localCliPath })
  if (cache.has(key)) return cache.get(key)!

  let executor: Executor
  if (type === 'local-cli') {
    executor = new LocalClaudeCliExecutor(config?.localCliPath ?? 'claude')
  } else {
    const _: never = type  // TypeScript exhaustive check
    throw new Error(`Unknown executor type: ${_}`)
  }

  cache.set(key, executor)
  return executor
}
