'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import { useStream } from '@/components/StreamProvider'
import { KanbanColumn } from '@/components/KanbanColumn'
import { KanbanCard } from '@/components/KanbanCard'
import { TaskStatus, Task } from '@/lib/types'

const COLUMNS: TaskStatus[] = [
  'backlog',
  'planning',
  'in-progress',
  'review',
  'changes-requested',
  'done',
]

export function KanbanBoard({ projectId }: { projectId: string }) {
  const { tasks, agents } = useStream()
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const projectTasks = tasks.filter((t) => t.projectId === projectId && !t.archived)

  function handleDragStart(event: DragStartEvent) {
    const task = projectTasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const taskId = active.id as string
    const newStatus = over.id as TaskStatus
    const task = projectTasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-6 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-dracula-darker [&::-webkit-scrollbar-thumb]:bg-dracula-dark [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="flex gap-3 w-full">
          {COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={projectTasks.filter((t) => t.status === status)}
              agents={agents}
            />
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            activeAgent={agents.find((a) => a.id === activeTask.activeAgentId)}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
