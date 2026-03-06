import { Agent, AgentEvent } from '@/lib/types'

type StoreListener = (agents: Agent[]) => void

interface Store {
  agents: Map<string, Agent>
  listeners: Set<StoreListener>
}

function createStore(): Store {
  return {
    agents: new Map(),
    listeners: new Set(),
  }
}

const globalForStore = globalThis as typeof globalThis & { __agentStore?: Store }

function getStore(): Store {
  if (!globalForStore.__agentStore) {
    globalForStore.__agentStore = createStore()
  }
  return globalForStore.__agentStore
}

function broadcast() {
  const store = getStore()
  const agents = Array.from(store.agents.values())
  for (const listener of store.listeners) {
    listener(agents)
  }
}

export function getAllAgents(): Agent[] {
  return Array.from(getStore().agents.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  )
}

export function getAgent(id: string): Agent | undefined {
  return getStore().agents.get(id)
}

export function addAgent(agent: Agent): void {
  getStore().agents.set(agent.id, agent)
  broadcast()
}

export function updateAgent(id: string, patch: Partial<Agent>): void {
  const store = getStore()
  const agent = store.agents.get(id)
  if (!agent) return
  store.agents.set(id, { ...agent, ...patch })
  broadcast()
}

export function appendEvent(id: string, event: AgentEvent): void {
  const store = getStore()
  const agent = store.agents.get(id)
  if (!agent) return
  store.agents.set(id, { ...agent, events: [...agent.events, event] })
  broadcast()
}

export function subscribe(listener: StoreListener): void {
  getStore().listeners.add(listener)
}

export function unsubscribe(listener: StoreListener): void {
  getStore().listeners.delete(listener)
}
