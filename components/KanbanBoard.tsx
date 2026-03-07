'use client'

import { useStream } from '@/components/StreamProvider'
import { KanbanColumn } from '@/components/KanbanColumn'
import { TaskStatus } from '@/lib/types'

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

  const projectTasks = tasks.filter((t) => t.projectId === projectId)

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
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
  )
}
