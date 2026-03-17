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
  /** User-defined and pipeline-set labels, e.g. ["approved", "bug", "tests-passed"]. */
  tags?: string[]
  /**
   * Derived: number of files attached to this task.
   * Populated server-side from a COUNT aggregation — never stored in the DB column.
   * Available on all tasks returned by SSE stream / REST endpoints.
   */
  fileCount?: number
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
  meetings?: Meeting[]
  meetingMessages?: MeetingMessage[]
  meetingSchedules?: MeetingSchedule[]
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

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------

export type MeetingStatus = 'setup' | 'writer-speaking' | 'discussion' | 'concluded'
export type MeetingMessageStatus = 'pending' | 'speaking' | 'done'
export type MeetingAgentType = 'writer' | 'researcher' | 'coder' | 'senior-coder' | 'tester'

/** The order in which agents speak during a meeting. */
export const MEETING_AGENT_ORDER: MeetingAgentType[] = [
  'writer', 'researcher', 'coder', 'senior-coder', 'tester',
]

export interface Meeting {
  id: string
  projectId: string
  topic: string
  status: MeetingStatus
  createdAt: number
  updatedAt: number
}

export interface MeetingMessage {
  id: number
  meetingId: string
  agentType: MeetingAgentType
  content: string
  status: MeetingMessageStatus
  startedAt?: number
  completedAt?: number
  /** Token and cost stats captured from the executor run. */
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  model?: string
}

export interface MeetingSchedule {
  id: string
  projectId: string
  cronExpression: string
  nextRunAt: number
  enabled: boolean
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export interface WeeklyTaskData {
  weekLabel: string
  done: number
  failed: number
}

export interface DailyTokenData {
  dateLabel: string
  inputTokens: number
  outputTokens: number
}

export interface DailyCostData {
  dateLabel: string
  cumulativeCost: number
}

export interface RoleCostData {
  role: string
  totalCost: number
}

export interface ProjectAnalyticsSummary {
  totalRunsDone: number
  totalRunsFailed: number
  totalCostUsd: number
  totalInputTokens: number
  totalOutputTokens: number
  avgCostPerRun: number
  avgDurationMs: number
  activeTaskCount: number
  successRate: number
}

export interface RecentRunEntry {
  id: string
  taskTitle: string
  role: string
  status: 'done' | 'failed'
  costUsd?: number
  durationMs: number
  completedAt: number
  model?: string
}

export interface RecentTaskEntry {
  id: string
  title: string
  status: TaskStatus
  updatedAt: number
}

export interface TaskStatusCount {
  status: string
  count: number
}

export interface MeetingsByDayData {
  dateLabel: string
  count: number
  costUsd: number
}

export interface MeetingAnalytics {
  totalMeetings: number
  totalMeetingCostUsd: number
  totalMeetingTokens: number
  meetingsByDay: MeetingsByDayData[]
}

export interface ProjectAnalyticsResponse {
  summary: ProjectAnalyticsSummary
  weeklyTasks: WeeklyTaskData[]
  dailyTokens: DailyTokenData[]
  dailyCost: DailyCostData[]
  costByRole: RoleCostData[]
  recentRuns: RecentRunEntry[]
  recentlyUpdatedTasks: RecentTaskEntry[]
  taskStatusCounts: TaskStatusCount[]
  meetingStats?: MeetingAnalytics
}
