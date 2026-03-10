export type AgentType = 'researcher' | 'coder' | 'writer' | 'senior-coder' | 'tester'
export type BoardType = 'coding' | 'research' | 'general'
export type AgentStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed'

export interface AgentEvent {
  timestamp: number
  text: string
}

/** Usage statistics extracted from Claude CLI execution. */
export interface AgentStats {
  /** Prompt / input tokens consumed. */
  inputTokens: number
  /** Completion / output tokens generated. */
  outputTokens: number
  /** inputTokens + outputTokens */
  totalTokens: number
  /** Number of agent conversation turns. */
  numTurns: number
  /** Estimated API cost in USD (may be absent if CLI doesn't emit it). */
  costUsd?: number
  /** Model identifier used for the run (e.g. "claude-opus-4-5"). */
  model?: string
}

export interface Agent {
  id: string
  type: AgentType
  prompt: string
  status: AgentStatus
  events: AgentEvent[]
  createdAt: number
  completedAt?: number
  taskStartedAt?: number
  error?: string
  projectId?: string
  taskId?: string
  systemPromptOverride?: string
  /** Live stats updated during and after a run; broadcast via SSE. */
  stats?: AgentStats
}

export type TaskStatus =
  | 'backlog'
  | 'planning'
  | 'in-progress'
  | 'review'
  | 'testing'
  | 'changes-requested'
  | 'done'

export interface Task {
  id: string
  projectId: string
  title: string
  description: string
  status: TaskStatus
  createdAt: number
  updatedAt: number
  activeAgentId?: string
  researcherOutput?: string
  coderOutput?: string
  reviewNotes?: string
  testerOutput?: string
  archived?: boolean
}

import type { ExecutorConfig } from '@/lib/executors/types'

export interface Project {
  id: string
  name: string
  description: string
  directory?: string
  boardType: BoardType
  createdAt: number
  updatedAt: number
  /** If absent, local-cli executor is used. */
  executorConfig?: ExecutorConfig
}

export interface StreamPayload {
  agents: Agent[]
  projects: Project[]
  tasks: Task[]
}

export interface TaskRun {
  id: string
  taskId: string
  taskTitle: string
  projectId: string
  projectName: string
  agentId: string
  role: string
  status: 'done' | 'failed'
  output: string
  error?: string
  rawLog?: string
  startedAt: number
  completedAt: number
  /** Token and cost stats persisted from the completed run. */
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  numTurns?: number
  costUsd?: number
  model?: string
}

export interface PaginatedRunsResponse {
  runs: TaskRun[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** A file attached to a task, stored on disk and tracked in the DB. */
export interface TaskFile {
  id: string
  taskId: string
  /** Original filename as provided by the user. */
  filename: string
  /** MIME type, e.g. "image/png", "application/pdf", "text/plain". */
  mimeType: string
  /** File size in bytes. */
  sizeBytes: number
  /**
   * Storage path relative to the project root,
   * e.g. "data/uploads/{taskId}/{uuid}-{sanitized-filename}".
   */
  storagePath: string
  createdAt: number
}

/** Whether an agent is actively running or waiting to start. */
export function isAgentActive(agent?: Agent | null): boolean {
  return agent?.status === 'running' || agent?.status === 'queued'
}
