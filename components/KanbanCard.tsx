'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Task, Agent, BoardType } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'
import { TaskDetailModal } from '@/components/TaskDetailModal'

type AssignRole = 'researcher' | 'coder' | 'senior-coder' | 'tester'

interface KanbanCardProps {
  task: Task
  activeAgent?: Agent
  boardType: BoardType
  autoOpen?: boolean
  onAutoOpenConsumed?: () => void
}

export function KanbanCard({ task, activeAgent, boardType, autoOpen, onAutoOpenConsumed }: KanbanCardProps) {
  const [loading, setLoading] = useState<AssignRole | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoOpen) {
      setModalOpen(true)
      onAutoOpenConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    willChange: isDragging ? 'transform' : undefined,
  }

  useEffect(() => {
    if (!menuOpen) return
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [menuOpen])

  async function assign(role: AssignRole) {
    setLoading(role)
    setAssignError(null)
    try {
      const res = await fetch(`/api/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        setAssignError(error)
        setTimeout(() => setAssignError(null), 5000)
      }
    } finally {
      setLoading(null)
    }
  }

  async function archiveTask() {
    setMenuOpen(false)
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
  }

  async function deleteTask() {
    setMenuOpen(false)
    if (!window.confirm(`Delete "${task.title}"? This cannot be undone.`)) return
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
  }

  function retryLastRole() {
    if (activeAgent?.type) {
      assign(activeAgent.type as AssignRole)
    }
  }

  const isAgentRunning = activeAgent?.status === 'running' || activeAgent?.status === 'queued'
  const isAgentFailed = activeAgent?.status === 'failed'

  const showAssignResearcher = task.status === 'backlog' && boardType !== 'general'
  const showAssignCoder = boardType === 'coding' && ((task.status === 'planning' && !isAgentRunning) || task.status === 'changes-requested')
  const showAssignSeniorCoder = boardType === 'coding' && task.status === 'in-progress' && !isAgentRunning
  const showAssignTester = boardType === 'coding' && task.status === 'testing' && !isAgentRunning

  const hasAssignAction = showAssignResearcher || showAssignCoder || showAssignSeniorCoder || showAssignTester

  const hasBottomMeta =
    (activeAgent && (isAgentRunning || activeAgent.status === 'done' || activeAgent.status === 'failed'))

  // Split error message into reason + recovery (separated by ' — ')
  const errorParts = activeAgent?.error?.split(' — ') ?? []
  const errorReason = errorParts[0] ?? activeAgent?.error ?? ''
  const errorRecovery = errorParts.length > 1 ? errorParts.slice(1).join(' — ') : null

  const cardContent = (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-1.5">
        <p className="text-sm font-medium text-dracula-light line-clamp-2 leading-snug">{task.title}</p>
        <div ref={menuRef} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
            className="rounded p-0.5 text-dracula-blue/60 hover:text-dracula-light hover:bg-dracula-dark/60 transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Card menu"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-50 min-w-[150px] rounded-lg border border-dracula-dark bg-dracula-darker shadow-xl py-1">
              {hasAssignAction && (
                <>
                  {showAssignResearcher && (
                    <button
                      onClick={() => { setMenuOpen(false); assign('researcher') }}
                      disabled={loading === 'researcher'}
                      className="w-full text-left px-3 py-1.5 text-xs text-dracula-cyan hover:bg-dracula-dark/60 hover:text-dracula-light transition-colors disabled:opacity-50"
                    >
                      {loading === 'researcher' ? 'Assigning…' : 'Assign Researcher'}
                    </button>
                  )}
                  {showAssignCoder && (
                    <button
                      onClick={() => { setMenuOpen(false); assign('coder') }}
                      disabled={loading === 'coder'}
                      className="w-full text-left px-3 py-1.5 text-xs text-dracula-green hover:bg-dracula-dark/60 hover:text-dracula-light transition-colors disabled:opacity-50"
                    >
                      {loading === 'coder' ? 'Assigning…' : 'Assign Coder'}
                    </button>
                  )}
                  {showAssignSeniorCoder && (
                    <button
                      onClick={() => { setMenuOpen(false); assign('senior-coder') }}
                      disabled={loading === 'senior-coder'}
                      className="w-full text-left px-3 py-1.5 text-xs text-dracula-orange hover:bg-dracula-dark/60 hover:text-dracula-light transition-colors disabled:opacity-50"
                    >
                      {loading === 'senior-coder' ? 'Assigning…' : 'Assign Senior Coder'}
                    </button>
                  )}
                  {showAssignTester && (
                    <button
                      onClick={() => { setMenuOpen(false); assign('tester') }}
                      disabled={loading === 'tester'}
                      className="w-full text-left px-3 py-1.5 text-xs text-dracula-pink hover:bg-dracula-dark/60 hover:text-dracula-light transition-colors disabled:opacity-50"
                    >
                      {loading === 'tester' ? 'Assigning…' : 'Assign Tester'}
                    </button>
                  )}
                  <div className="border-t border-dracula-dark/60 my-1" />
                </>
              )}
              <button
                onClick={archiveTask}
                className="w-full text-left px-3 py-1.5 text-xs text-dracula-blue hover:bg-dracula-dark/60 hover:text-dracula-light transition-colors"
              >
                Archive
              </button>
              <button
                onClick={deleteTask}
                className="w-full text-left px-3 py-1.5 text-xs text-dracula-red hover:bg-dracula-red/10 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p className="text-xs text-dracula-comment line-clamp-1">{task.description}</p>
      )}

      {task.reviewNotes && task.status === 'changes-requested' && (
        <div className="rounded bg-dracula-red/10 border border-dracula-red/30 p-1.5">
          <p className="text-xs text-dracula-red font-medium mb-0.5">Review Notes</p>
          <p className="text-xs text-dracula-light/80 line-clamp-3">{task.reviewNotes}</p>
        </div>
      )}

      {task.testerOutput && task.status === 'testing' && (
        <div className="rounded bg-dracula-orange/10 border border-dracula-orange/30 p-1.5">
          <p className="text-xs text-dracula-orange font-medium mb-0.5">Test Failures</p>
          <p className="text-xs text-dracula-light/80 line-clamp-3">{task.testerOutput}</p>
        </div>
      )}

      {hasBottomMeta && (
        <div className="flex items-center gap-2 pt-1.5 mt-1.5 border-t border-dracula-dark/40">
          {activeAgent && isAgentRunning && <StatusBadge status={activeAgent.status} />}
          {activeAgent && (activeAgent.status === 'done' || activeAgent.status === 'failed') && (
            <Link
              href={`/agents/${activeAgent.id}`}
              className="text-xs text-dracula-cyan hover:text-dracula-light"
              onClick={(e) => e.stopPropagation()}
            >
              View Output →
            </Link>
          )}
        </div>
      )}

      {isAgentFailed && activeAgent?.error && (
        <div className="rounded bg-dracula-red/10 border border-dracula-red/30 p-1.5 mt-1.5">
          <p className="text-xs text-dracula-red font-medium">⚠ Agent Failed</p>
          <p className="text-xs text-dracula-light/80 mt-0.5 line-clamp-2">{errorReason}</p>
          {errorRecovery && (
            <p className="text-xs text-dracula-orange/80 mt-0.5 line-clamp-2">💡 {errorRecovery}</p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); retryLastRole() }}
            className="text-xs text-dracula-cyan hover:text-dracula-light mt-1 transition-colors"
          >
            ↻ Retry
          </button>
        </div>
      )}

      {assignError && (
        <p className="text-xs text-dracula-red mt-1.5 leading-snug">{assignError}</p>
      )}
    </div>
  )

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={() => setModalOpen(true)}
        className={`group rounded-lg border border-dracula-dark/60 bg-dracula-dark shadow-sm p-3 hover:border-dracula-purple/40 hover:shadow-md transition-all cursor-pointer ${isDragging ? 'opacity-40' : ''}`}
      >
        {cardContent}
      </div>
      {modalOpen && <TaskDetailModal task={task} onClose={() => setModalOpen(false)} />}
    </>
  )
}
