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
  const label = COLUMN_LABELS[status]
  const accentClass = COLUMN_ACCENT[status]

  return (
    <div className="flex flex-col min-w-[220px] w-[220px] shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${accentClass}`}>
          {label}
        </h3>
        <span className="rounded-full bg-dracula-dark px-1.5 py-0.5 text-xs text-dracula-blue font-medium">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 min-h-[100px]">
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
