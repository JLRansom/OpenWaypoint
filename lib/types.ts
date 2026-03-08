export type AgentType = 'researcher' | 'coder' | 'writer' | 'senior-coder'
export type AgentStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed'

export interface AgentEvent {
  timestamp: number
  text: string
}

export interface Agent {
  id: string
  type: AgentType
  prompt: string
  status: AgentStatus
  events: AgentEvent[]
  createdAt: number
  completedAt?: number
  error?: string
  projectId?: string
  taskId?: string
  systemPromptOverride?: string
}

export type TaskStatus =
  | 'backlog'
  | 'planning'
  | 'in-progress'
  | 'review'
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
  archived?: boolean
}

import type { ExecutorConfig } from '@/lib/executors/types'

export interface Project {
  id: string
  name: string
  description: string
  directory?: string
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
  startedAt: number
  completedAt: number
}
