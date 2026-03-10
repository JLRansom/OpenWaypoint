import { Agent, AgentEvent, Project, Task, StreamPayload } from '@/lib/types'
import { broadcast } from '@/lib/broadcast'
import {
  dbGetAllAgents,
  dbGetAgent,
  dbAddAgent,
  dbUpdateAgent,
  dbAppendEvent,
  dbDeleteAgent,
} from '@/lib/db/repositories/agentRepo'
import {
  dbGetAllProjects,
  dbGetProject,
  dbAddProject,
  dbUpdateProject,
} from '@/lib/db/repositories/projectRepo'
import {
  dbGetAllTasks,
  dbGetTask,
  dbGetTasksByProject,
  dbAddTask,
  dbUpdateTask,
  dbDeleteTask,
} from '@/lib/db/repositories/taskRepo'

export { subscribe, unsubscribe } from '@/lib/broadcast'

function getStreamPayload(): StreamPayload {
  return {
    agents: dbGetAllAgents(),
    projects: dbGetAllProjects(),
    tasks: dbGetAllTasks(),
  }
}

// --- Agent functions ---

export function getAllAgents(): Agent[] {
  return dbGetAllAgents()
}

export function getAgent(id: string): Agent | undefined {
  return dbGetAgent(id)
}

export function addAgent(agent: Agent): void {
  dbAddAgent(agent)
  broadcast(getStreamPayload())
}

export function updateAgent(id: string, patch: Partial<Agent>): void {
  dbUpdateAgent(id, patch)
  broadcast(getStreamPayload())
}

export function appendEvent(id: string, event: AgentEvent): void {
  dbAppendEvent(id, event)
  broadcast(getStreamPayload())
}

export function deleteAgent(id: string): void {
  dbDeleteAgent(id)
  broadcast(getStreamPayload())
}

// --- Project functions ---

export function getAllProjects(): Project[] {
  return dbGetAllProjects()
}

export function getProject(id: string): Project | undefined {
  return dbGetProject(id)
}

export function addProject(project: Project): void {
  dbAddProject(project)
  broadcast(getStreamPayload())
}

export function updateProject(id: string, patch: Partial<Project>): void {
  dbUpdateProject(id, patch)
  broadcast(getStreamPayload())
}

// --- Task functions ---

export function getAllTasks(): Task[] {
  return dbGetAllTasks()
}

export function getTask(id: string): Task | undefined {
  return dbGetTask(id)
}

export function getTasksByProject(projectId: string): Task[] {
  return dbGetTasksByProject(projectId)
}

export function addTask(task: Task): void {
  dbAddTask(task)
  broadcast(getStreamPayload())
}

export function updateTask(id: string, patch: Partial<Task>): void {
  dbUpdateTask(id, patch)
  broadcast(getStreamPayload())
}

export function deleteTask(id: string): void {
  dbDeleteTask(id)
  broadcast(getStreamPayload())
}

// --- Full payload (for initial SSE load) ---

export { getStreamPayload }
