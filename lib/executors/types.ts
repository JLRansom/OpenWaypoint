import type { Agent } from '@/lib/types'

export interface TextChunk {
  text: string
  timestamp: number
}

export interface ExecutorRunOptions {
  agent: Agent
  /** Absolute path — executor sets this as the subprocess cwd. */
  workingDirectory?: string
  onChunk: (chunk: TextChunk) => void
  signal: AbortSignal
}

export interface Executor {
  run(options: ExecutorRunOptions): Promise<void>
}

/** Extend this union when adding RemoteSSHExecutor, RelayApiExecutor, etc. */
export type ExecutorType = 'local-cli'

export interface ExecutorConfig {
  type: ExecutorType
  /** Override path to claude binary. Defaults to 'claude' (PATH). */
  localCliPath?: string

  // ── Future remote fields (not wired up yet) ──────────────────────
  sshTarget?: string
  sshPort?: number
  sshIdentityFile?: string
  relayApiUrl?: string
  relayApiToken?: string
}
