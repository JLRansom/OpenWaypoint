import { Agent, AgentEvent, Project, Task, StreamPayload } from '@/lib/types'

type StoreListener = (payload: StreamPayload) => void

interface Store {
  agents: Map<string, Agent>
  projects: Map<string, Project>
  tasks: Map<string, Task>
  listeners: Set<StoreListener>
}

function createStore(): Store {
  return {
    agents: new Map(),
    projects: new Map(),
    tasks: new Map(),
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
  const payload: StreamPayload = {
    agents: Array.from(store.agents.values()),
    projects: Array.from(store.projects.values()),
    tasks: Array.from(store.tasks.values()),
  }
  for (const listener of store.listeners) {
    listener(payload)
  }
}

// --- Agent functions ---

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

// --- Project functions ---

export function getAllProjects(): Project[] {
  return Array.from(getStore().projects.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  )
}

export function getProject(id: string): Project | undefined {
  return getStore().projects.get(id)
}

export function addProject(project: Project): void {
  getStore().projects.set(project.id, project)
  broadcast()
}

export function updateProject(id: string, patch: Partial<Project>): void {
  const store = getStore()
  const project = store.projects.get(id)
  if (!project) return
  store.projects.set(id, { ...project, ...patch })
  broadcast()
}

// --- Task functions ---

export function getAllTasks(): Task[] {
  return Array.from(getStore().tasks.values()).sort(
    (a, b) => b.createdAt - a.createdAt
  )
}

export function getTask(id: string): Task | undefined {
  return getStore().tasks.get(id)
}

export function getTasksByProject(projectId: string): Task[] {
  return getAllTasks().filter((t) => t.projectId === projectId)
}

export function addTask(task: Task): void {
  getStore().tasks.set(task.id, task)
  broadcast()
}

export function updateTask(id: string, patch: Partial<Task>): void {
  const store = getStore()
  const task = store.tasks.get(id)
  if (!task) return
  store.tasks.set(id, { ...task, ...patch, updatedAt: Date.now() })
  broadcast()
}

export function deleteTask(id: string): void {
  getStore().tasks.delete(id)
  broadcast()
}

// --- Full payload (for initial SSE load) ---

export function getStreamPayload(): StreamPayload {
  return {
    agents: getAllAgents(),
    projects: getAllProjects(),
    tasks: getAllTasks(),
  }
}
