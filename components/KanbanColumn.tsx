import { useDroppable } from '@dnd-kit/core'
import { Task, Agent, TaskStatus, BoardType } from '@/lib/types'
import { KanbanCard } from '@/components/KanbanCard'
import { AddCardForm } from '@/components/AddCardForm'

const COLUMN_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  planning: 'Planning',
  'in-progress': 'In Progress',
  review: 'Review',
  testing: 'Testing',
  'changes-requested': 'Changes Requested',
  done: 'Done',
}

const COLUMN_ACCENT: Record<TaskStatus, string> = {
  backlog: 'text-dracula-blue',
  planning: 'text-dracula-cyan',
  'in-progress': 'text-dracula-green',
  review: 'text-dracula-orange',
  testing: 'text-dracula-pink',
  'changes-requested': 'text-dracula-red',
  done: 'text-dracula-purple',
}


interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  agents: Agent[]
  projectId: string
  boardType: BoardType
  isAddActive: boolean
  onAddActivate: () => void
  onAddDeactivate: () => void
  autoOpenCardId?: string
  onAutoOpenConsumed: () => void
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}

export function KanbanColumn({ status, tasks, agents, projectId, boardType, isAddActive, onAddActivate, onAddDeactivate, autoOpenCardId, onAutoOpenConsumed, selectedIds, onToggleSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const baseLabel = COLUMN_LABELS[status]
  const label = status === 'backlog' && boardType === 'general' ? 'To Do' : baseLabel
  const accentClass = COLUMN_ACCENT[status]

  const isEmpty = tasks.length === 0

  return (
    <div className={`flex flex-col flex-1 min-w-[150px] rounded-xl border transition-all ${isOver ? 'bg-dracula-surface/80 border-dracula-purple/40 ring-1 ring-dracula-purple/30' : 'bg-dracula-surface border-dracula-dark/50'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dracula-dark/40">
        <h3 className={`text-[11px] font-bold uppercase tracking-widest truncate ${accentClass}`}>
          {label}
        </h3>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 ${isEmpty ? 'bg-dracula-dark/60 text-dracula-comment' : 'bg-dracula-dark text-dracula-blue'}`}>
          {tasks.length}
        </span>
      </div>

      {/* Cards or compact drop zone */}
      <div
        ref={setNodeRef}
        className={isEmpty
          ? `m-2 rounded-lg border border-dashed transition-colors min-h-[52px] ${isOver ? 'border-dracula-purple/50 bg-dracula-purple/5' : 'border-dracula-dark/40'}`
          : 'flex flex-col gap-1.5 p-2'
        }
      >
        {tasks.map((task) => {
          const activeAgent = task.activeAgentId
            ? agents.find((a) => a.id === task.activeAgentId)
            : undefined
          return (
            <KanbanCard
              key={task.id}
              task={task}
              activeAgent={activeAgent}
              boardType={boardType}
              autoOpen={autoOpenCardId === task.id}
              onAutoOpenConsumed={onAutoOpenConsumed}
              isSelected={selectedIds.has(task.id)}
              onToggleSelect={onToggleSelect}
            />
          )
        })}
      </div>

      {/* Add card */}
      <div className="p-2 pt-0">
        <AddCardForm
          projectId={projectId}
          status={status}
          isActive={isAddActive}
          onActivate={onAddActivate}
          onDeactivate={onAddDeactivate}
        />
      </div>
    </div>
  )
}
