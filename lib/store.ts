import { Agent, AgentEvent, Project, Task, TaskFile, StreamPayload } from '@/lib/types'
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
import {
  dbGetFilesByTask,
  dbGetTaskFile,
  dbAddTaskFile,
  dbDeleteTaskFile,
  dbDeleteTaskFilesByTask,
} from '@/lib/db/repositories/taskFileRepo'
import {
  dbGetSetting,
  dbSetSetting,
} from '@/lib/db/repositories/settingsRepo'

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

export function getTasksByProject(projectId: string, opts?: { archived?: boolean }): Task[] {
  return dbGetTasksByProject(projectId, opts)
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

// --- Task file functions ---
// File mutations broadcast SSE so that the fileCount field on Task objects
// in the stream is updated immediately after an upload or delete.
// The full variant of FileAttachmentList (modal) still fetches on demand
// via REST; only the compact badge on cards uses the SSE-derived fileCount.

export function getFilesByTask(taskId: string): TaskFile[] {
  return dbGetFilesByTask(taskId)
}

export function getTaskFile(id: string): TaskFile | undefined {
  return dbGetTaskFile(id)
}

export function addTaskFile(file: TaskFile): void {
  dbAddTaskFile(file)
  broadcast(getStreamPayload())
}

/**
 * Delete a file record and return the deleted record so the caller can
 * also remove the bytes from disk.
 */
export function deleteTaskFile(id: string): TaskFile | undefined {
  const deleted = dbDeleteTaskFile(id)
  broadcast(getStreamPayload())
  return deleted
}

/**
 * Delete ALL file records for a task (used when the task itself is deleted).
 * Returns the deleted records so the caller can clean up files on disk.
 */
export function deleteTaskFilesByTask(taskId: string): TaskFile[] {
  return dbDeleteTaskFilesByTask(taskId)
}

// --- Settings functions ---

export function getSetting(key: string): string | undefined {
  return dbGetSetting(key)
}

export function setSetting(key: string, value: string): void {
  dbSetSetting(key, value)
}

// --- Full payload (for initial SSE load) ---

export { getStreamPayload }
