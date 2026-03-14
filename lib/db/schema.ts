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
  /** JSON-serialised string[] — e.g. '["approved","bug"]'. */
  tags:             text('tags').notNull().default('[]'),
  createdAt:        integer('created_at').notNull(),
  updatedAt:        integer('updated_at').notNull(),
})

/** File attachments for tasks — each row tracks one uploaded file on disk. */
export const taskFiles = sqliteTable('task_files', {
  id:          text('id').primaryKey(),
  taskId:      text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  filename:    text('filename').notNull(),
  mimeType:    text('mime_type').notNull(),
  sizeBytes:   integer('size_bytes').notNull(),
  /** Relative path from project root, e.g. data/uploads/{taskId}/{uuid}-{filename}. */
  storagePath: text('storage_path').notNull(),
  createdAt:   integer('created_at').notNull(),
})

/** App-wide key/value settings. Keys are well-known strings; values are stored
 *  as text (booleans as 'true'/'false', numbers as numeric strings). */
export const settings = sqliteTable('settings', {
  key:       text('key').primaryKey(),
  value:     text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/** Recurring meeting schedules using cron expressions. */
export const meetingSchedules = sqliteTable('meeting_schedules', {
  id:             text('id').primaryKey(),
  projectId:      text('project_id').notNull().references(() => projects.id),
  cronExpression: text('cron_expression').notNull(),
  nextRunAt:      integer('next_run_at').notNull(),
  enabled:        integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt:      integer('created_at').notNull(),
  updatedAt:      integer('updated_at').notNull(),
})

/** Meetings — collaborative agent discussions on a topic. */
export const meetings = sqliteTable('meetings', {
  id:        text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id),
  topic:     text('topic').notNull(),
  status:    text('status').notNull().default('setup'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

/** Individual agent messages within a meeting. */
export const meetingMessages = sqliteTable('meeting_messages', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  meetingId:    text('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  agentType:    text('agent_type').notNull(),
  content:      text('content').notNull().default(''),
  status:       text('status').notNull().default('pending'),
  startedAt:    integer('started_at'),
  completedAt:  integer('completed_at'),
  inputTokens:  integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costUsd:      real('cost_usd'),
  model:        text('model'),
})
