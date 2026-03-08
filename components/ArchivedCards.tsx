'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ArchiveRestore } from 'lucide-react'
import { useStream } from '@/components/StreamProvider'
import { TaskStatus } from '@/lib/types'

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

export function ArchivedCards({ projectId }: { projectId: string }) {
  const { tasks } = useStream()
  const [open, setOpen] = useState(false)

  const archivedTasks = tasks.filter((t) => t.projectId === projectId && t.archived)

  if (archivedTasks.length === 0) return null

  async function unarchive(taskId: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    })
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-dracula-comment">
          Archived
        </span>
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-dracula-dark/60 text-dracula-comment">
          {archivedTasks.length}
        </span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-dracula-comment ml-auto" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-dracula-comment ml-auto" />
        )}
      </button>

      {open && (
        <div className="mt-2 border border-dracula-dark/50 rounded-xl divide-y divide-dracula-dark/40">
          {archivedTasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm text-dracula-light flex-1 truncate">{task.title}</span>
              <span className={`text-[10px] font-semibold uppercase ${COLUMN_ACCENT[task.status]}`}>
                {COLUMN_LABELS[task.status]}
              </span>
              <button
                onClick={() => unarchive(task.id)}
                title={`Restore to ${COLUMN_LABELS[task.status]}`}
                className="text-dracula-comment hover:text-dracula-green transition-colors"
              >
                <ArchiveRestore className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
