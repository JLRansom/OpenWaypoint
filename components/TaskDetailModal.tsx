'use client'

import { useState, useEffect } from 'react'
import { Task, TaskStatus } from '@/lib/types'

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

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function save() {
    if (title === task.title && description === task.description) {
      onClose()
      return
    }
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dracula-darker rounded-xl border border-dracula-dark/60 w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
            Title
          </label>
          <input
            className="w-full bg-dracula-dark border border-dracula-dark/80 rounded-lg px-3 py-2 text-lg font-semibold text-dracula-light placeholder-dracula-comment focus:outline-none focus:border-dracula-purple/60 transition-colors"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
            Description
          </label>
          <textarea
            rows={4}
            className="w-full bg-dracula-dark border border-dracula-dark/80 rounded-lg px-3 py-2 text-sm text-dracula-light placeholder-dracula-comment focus:outline-none focus:border-dracula-purple/60 transition-colors resize-none"
            placeholder="Add a description…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Column badge */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
            Column
          </p>
          <span className={`text-xs font-semibold uppercase ${COLUMN_ACCENT[task.status]}`}>
            {COLUMN_LABELS[task.status]}
          </span>
        </div>

        {/* Dates */}
        <div className="flex gap-6">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
              Date Added
            </p>
            <p className="text-xs text-dracula-comment">{formatDate(task.createdAt)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
              Last Modified
            </p>
            <p className="text-xs text-dracula-comment">{formatDate(task.updatedAt)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-dracula-comment hover:text-dracula-light rounded-lg hover:bg-dracula-dark/60 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-1.5 text-sm font-semibold bg-dracula-purple/20 text-dracula-purple border border-dracula-purple/40 rounded-lg hover:bg-dracula-purple/30 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
