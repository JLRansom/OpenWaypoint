'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, CreditCard, Search, X } from 'lucide-react'
import type { Task } from '@/lib/types'

interface Props {
  projectId: string
  onSelect: (meetingType: 'ideas' | 'card-discussion', taskId?: string) => void
  onClose: () => void
}

export function MeetingTypeSelector({ projectId, onSelect, onClose }: Props) {
  const [mode, setMode] = useState<'pick-type' | 'pick-card'>('pick-type')
  const [tasks, setTasks] = useState<Task[]>([])
  const [search, setSearch] = useState('')
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Fetch tasks when user picks card-discussion
  function handleCardDiscussionClick() {
    setMode('pick-card')
    if (tasks.length === 0) {
      setLoadingTasks(true)
      fetch(`/api/projects/${projectId}/tasks`)
        .then((r) => r.json())
        .then((data: Task[]) => {
          // Filter to non-archived tasks
          setTasks(data.filter((t) => !t.archived))
        })
        .catch(console.error)
        .finally(() => setLoadingTasks(false))
    }
  }

  const filteredTasks = tasks.filter(
    (t) =>
      !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-dracula-darker rounded-xl border border-dracula-dark/60 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dracula-dark/50">
          <p className="text-sm font-semibold text-dracula-light">
            {mode === 'pick-type' ? 'Start a Meeting' : 'Pick a Card to Discuss'}
          </p>
          <button onClick={onClose} className="text-dracula-comment hover:text-dracula-light transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'pick-type' && (
          <div className="p-5 space-y-3">
            {/* Ideas option */}
            <button
              onClick={() => onSelect('ideas')}
              className="w-full flex items-start gap-3 p-4 rounded-lg border border-dracula-purple/30 bg-dracula-purple/10 hover:bg-dracula-purple/20 text-left transition-colors group"
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-dracula-purple/20 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-dracula-purple" />
              </div>
              <div>
                <p className="text-sm font-semibold text-dracula-purple mb-0.5">Ideas Meeting</p>
                <p className="text-xs text-dracula-comment leading-relaxed">
                  The writer analyzes the project and proposes a creative idea. All agents discuss it in sequence.
                </p>
              </div>
            </button>

            {/* Card Discussion option */}
            <button
              onClick={handleCardDiscussionClick}
              className="w-full flex items-start gap-3 p-4 rounded-lg border border-dracula-cyan/30 bg-dracula-cyan/10 hover:bg-dracula-cyan/20 text-left transition-colors group"
            >
              <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-dracula-cyan/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-dracula-cyan" />
              </div>
              <div>
                <p className="text-sm font-semibold text-dracula-cyan mb-0.5">Card Discussion</p>
                <p className="text-xs text-dracula-comment leading-relaxed">
                  Pick a task from the board. Agents discuss it, and meeting notes are appended to the card description.
                </p>
              </div>
            </button>
          </div>
        )}

        {mode === 'pick-card' && (
          <div className="p-5">
            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dracula-comment" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-dracula-dark border border-dracula-dark/80 rounded-lg text-xs text-dracula-light placeholder-dracula-comment focus:outline-none focus:border-dracula-cyan"
                autoFocus
              />
            </div>

            {/* Task list */}
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {loadingTasks && (
                <p className="text-xs text-dracula-comment italic text-center py-4">Loading tasks...</p>
              )}
              {!loadingTasks && filteredTasks.length === 0 && (
                <p className="text-xs text-dracula-comment italic text-center py-4">No tasks found.</p>
              )}
              {filteredTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onSelect('card-discussion', task.id)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-dracula-dark/60 hover:bg-dracula-dark border border-transparent hover:border-dracula-cyan/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-dracula-comment bg-dracula-darker px-1.5 py-0.5 rounded">
                      {task.status}
                    </span>
                    <span className="text-xs text-dracula-light truncate">{task.title}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Back button */}
            <button
              onClick={() => setMode('pick-type')}
              className="mt-3 text-xs text-dracula-comment hover:text-dracula-light transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
