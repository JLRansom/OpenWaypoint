import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const agents = sqliteTable('agents', {
  id:                   text('id').primaryKey(),
  type:                 text('type').notNull(),
  prompt:               text('prompt').notNull().default(''),
  status:               text('status').notNull().default('idle'),
  projectId:            text('project_id'),
  taskId:               text('task_id'),
  systemPromptOverride: text('system_prompt_override'),
  error:                text('error'),
  createdAt:            integer('created_at').notNull(),
  completedAt:          integer('completed_at'),
  taskStartedAt:        integer('task_started_at'),
  /** JSON-serialised AgentStats — ephemeral, only needed for live SSE display. */
  stats:                text('stats'),
})

export const agentEvents = sqliteTable('agent_events', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  agentId:   text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  timestamp: integer('timestamp').notNull(),
  text:      text('text').notNull(),
})

export const projects = sqliteTable('projects', {
  id:             text('id').primaryKey(),
  name:           text('name').notNull(),
  description:    text('description').notNull().default(''),
  directory:      text('directory'),
  boardType:      text('board_type').notNull().default('coding'),
  executorConfig: text('executor_config'),   // JSON-serialised ExecutorConfig
  createdAt:      integer('created_at').notNull(),
  updatedAt:      integer('updated_at').notNull(),
})

export const taskRuns = sqliteTable('task_runs', {
  id:          text('id').primaryKey(),
  taskId:      text('task_id').notNull(),
  taskTitle:   text('task_title').notNull(),
  projectId:   text('project_id').notNull(),
  projectName: text('project_name').notNull(),
  agentId:     text('agent_id').notNull(),
  role:        text('role').notNull(),
  status:      text('status').notNull(),
  output:      text('output').notNull().default(''),
  error:        text('error'),
  rawLog:       text('raw_log'),
  startedAt:    integer('started_at').notNull(),
  completedAt:  integer('completed_at').notNull(),
  inputTokens:  integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  numTurns:     integer('num_turns'),
  costUsd:      real('cost_usd'),
  model:        text('model'),
})

export const tasks = sqliteTable('tasks', {
  id:               text('id').primaryKey(),
  projectId:        text('project_id').notNull().references(() => projects.id),
  title:            text('title').notNull(),
  description:      text('description').notNull().default(''),
  status:           text('status').notNull().default('backlog'),
  activeAgentId:    text('active_agent_id'),
  researcherOutput: text('researcher_output'),
  coderOutput:      text('coder_output'),
  reviewNotes:      text('review_notes'),
  testerOutput:     text('tester_output'),
  archived:         integer('archived', { mode: 'boolean' }).default(false),
  createdAt:        integer('created_at').notNull(),
  updatedAt:        integer('updated_at').notNull(),
})
