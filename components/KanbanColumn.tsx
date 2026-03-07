import { useDroppable } from '@dnd-kit/core'
import { Task, Agent, TaskStatus } from '@/lib/types'
import { KanbanCard } from '@/components/KanbanCard'

const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  planning: 'Planning',
  'in-progress': 'In Progress',
  review: 'Review',
  'changes-requested': 'Changes Requested',
  done: 'Done',
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  backlog: 'text-dracula-blue',
  planning: 'text-dracula-cyan',
  'in-progress': 'text-dracula-green',
  review: 'text-dracula-orange',
  'changes-requested': 'text-dracula-red',
  done: 'text-dracula-purple',
}


interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  agents: Agent[]
}

export function KanbanColumn({ status, tasks, agents }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const label = COLUMN_LABELS[status]
  const accentClass = COLUMN_ACCENT[status]

  return (
    <div className={`flex flex-col flex-1 min-w-[150px] rounded-xl bg-dracula-darker/60 transition-all ${isOver ? 'ring-1 ring-dracula-purple/50 bg-dracula-dark/40' : ''}`}>
      <div className="sticky top-0 z-10 flex items-center gap-2 px-2 pt-2 pb-1.5 rounded-t-xl bg-dracula-darker/80 backdrop-blur-sm">
        <h3 className={`text-xs font-semibold uppercase tracking-wider truncate ${accentClass}`}>
          {label}
        </h3>
        <span className="rounded-full bg-dracula-dark px-1.5 py-0.5 text-[10px] text-dracula-blue font-medium shrink-0">
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col gap-1.5 p-2 min-h-[120px]"
      >
        {tasks.map((task) => {
          const activeAgent = task.activeAgentId
            ? agents.find((a) => a.id === task.activeAgentId)
            : undefined
          return (
            <KanbanCard key={task.id} task={task} activeAgent={activeAgent} />
          )
        })}
      </div>
    </div>
  )
}
