export type AgentType = 'researcher' | 'coder' | 'writer'
export type AgentStatus = 'queued' | 'running' | 'done' | 'failed'

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
}
