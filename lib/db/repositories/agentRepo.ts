import { eq } from 'drizzle-orm'
import { db } from '../client'
import { agents, agentEvents } from '../schema'
import { Agent, AgentEvent } from '@/lib/types'

type AgentRow = typeof agents.$inferSelect
type EventRow = typeof agentEvents.$inferSelect

function rowToAgent(row: AgentRow, events: AgentEvent[]): Agent {
  return {
    id: row.id,
    type: row.type as Agent['type'],
    prompt: row.prompt,
    status: row.status as Agent['status'],
    events,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
    taskStartedAt: row.taskStartedAt ?? undefined,
    error: row.error ?? undefined,
    projectId: row.projectId ?? undefined,
    taskId: row.taskId ?? undefined,
    systemPromptOverride: row.systemPromptOverride ?? undefined,
  }
}

export function dbGetAllAgents(): Agent[] {
  const agentRows = db.select().from(agents).orderBy(agents.createdAt).all()
  const eventRows = db.select().from(agentEvents).orderBy(agentEvents.id).all()

  const eventsByAgent = new Map<string, AgentEvent[]>()
  for (const e of eventRows) {
    const list = eventsByAgent.get(e.agentId) ?? []
    list.push({ timestamp: e.timestamp, text: e.text })
    eventsByAgent.set(e.agentId, list)
  }

  return agentRows
    .map((row) => rowToAgent(row, eventsByAgent.get(row.id) ?? []))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function dbGetAgent(id: string): Agent | undefined {
  const row = db.select().from(agents).where(eq(agents.id, id)).get()
  if (!row) return undefined

  const eventRows = db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.agentId, id))
    .orderBy(agentEvents.id)
    .all()

  const events: AgentEvent[] = eventRows.map((e: EventRow) => ({
    timestamp: e.timestamp,
    text: e.text,
  }))

  return rowToAgent(row, events)
}

export function dbAddAgent(agent: Agent): void {
  db.insert(agents).values({
    id: agent.id,
    type: agent.type,
    prompt: agent.prompt,
    status: agent.status,
    projectId: agent.projectId ?? null,
    taskId: agent.taskId ?? null,
    systemPromptOverride: agent.systemPromptOverride ?? null,
    error: agent.error ?? null,
    createdAt: agent.createdAt,
    completedAt: agent.completedAt ?? null,
    taskStartedAt: agent.taskStartedAt ?? null,
  }).run()
}

export function dbUpdateAgent(id: string, patch: Partial<Agent>): void {
  const update: Partial<typeof agents.$inferInsert> = {}

  if (patch.type !== undefined) update.type = patch.type
  if (patch.prompt !== undefined) update.prompt = patch.prompt
  if (patch.status !== undefined) update.status = patch.status
  if ('projectId' in patch) update.projectId = patch.projectId ?? null
  if ('taskId' in patch) update.taskId = patch.taskId ?? null
  if ('systemPromptOverride' in patch) update.systemPromptOverride = patch.systemPromptOverride ?? null
  if ('error' in patch) update.error = patch.error ?? null
  if ('completedAt' in patch) update.completedAt = patch.completedAt ?? null
  if ('taskStartedAt' in patch) update.taskStartedAt = patch.taskStartedAt ?? null

  if (Object.keys(update).length === 0) return

  db.update(agents).set(update).where(eq(agents.id, id)).run()

  // If events array is explicitly set to empty (reset), delete existing events
  if (patch.events !== undefined && patch.events.length === 0) {
    db.delete(agentEvents).where(eq(agentEvents.agentId, id)).run()
  }
}

export function dbAppendEvent(agentId: string, event: AgentEvent): void {
  db.insert(agentEvents).values({
    agentId,
    timestamp: event.timestamp,
    text: event.text,
  }).run()
}

export function dbDeleteAgent(id: string): void {
  db.delete(agents).where(eq(agents.id, id)).run()
}
