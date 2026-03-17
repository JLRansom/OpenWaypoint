'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Task, Agent, BoardType, isAgentActive, TaskRun, TaskFile, ProjectTag } from '@/lib/types'
import { AgentProgressBar } from '@/components/AgentProgressBar'
import { TaskDetailModal } from '@/components/TaskDetailModal'
import { FileDropZone } from '@/components/FileDropZone'
import { FileAttachmentList } from '@/components/FileAttachmentList'
import { formatTokens, formatCost } from '@/lib/format-utils'

type AssignRole = 'researcher' | 'coder' | 'senior-coder' | 'tester'

/** Colour overrides for well-known pipeline-generated tags. */
const TAG_COLORS: Record<string, string> = {
  'approved':           'bg-dracula-green/20 text-dracula-green border-dracula-green/30',
  'tests-passed':       'bg-dracula-green/20 text-dracula-green border-dracula-green/30',
  'tests-failed':       'bg-dracula-orange/20 text-dracula-orange border-dracula-orange/30',
  'changes-requested':  'bg-dracula-red/20 text-dracula-red border-dracula-red/30',
  'bug':                'bg-dracula-red/20 text-dracula-red border-dracula-red/30',
  'blocked':            'bg-dracula-red/20 text-dracula-red border-dracula-red/30',
}
const TAG_COLOR_DEFAULT = 'bg-dracula-purple/20 text-dracula-purple border-dracula-purple/30'

interface KanbanCardProps {
  task: Task
  activeAgent?: Agent
  boardType: BoardType
  projectTags?: ProjectTag[]
  autoOpen?: boolean
  onAutoOpenConsumed?: () => void
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export function KanbanCard({ task, activeAgent, boardType, projectTags, autoOpen, onAutoOpenConsumed, isSelected = false, onToggleSelect }: KanbanCardProps) {
  const [loading, setLoading] = useState<AssignRole | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [runs, setRuns] = useState<TaskRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [files, setFiles] = useState<TaskFile[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoOpen) {
      setModalOpen(true)
      onAutoOpenConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const runsCtrl = new AbortController()
    const filesCtrl = new AbortController()
    setRunsLoading(true)
    fetch(`/api/tasks/${task.id}/runs`, { signal: runsCtrl.signal })
      .then((r) => r.json())
      .then((data: TaskRun[]) => setRuns(data))
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') throw e })
      .finally(() => setRunsLoading(false))
    fetch(`/api/tasks/${task.id}/files`, { signal: filesCtrl.signal })
      .then((r) => r.json())
      .then((data: TaskFile[]) => setFiles(data))
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') throw e })
    return () => { runsCtrl.abort(); filesCtrl.abort() }
  }, [modalOpen, task.id])

  function refreshFiles() {
    const ctrl = new AbortController()
    fetch(`/api/tasks/${task.id}/files`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data: TaskFile[]) => setFiles(data))
      .catch((e: unknown) => { if ((e as Error).name !== 'AbortError') throw e })
  }

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

  const isAgentRunning = isAgentActive(activeAgent)
  const isAgentFailed = activeAgent?.status === 'failed'

  const MID_PIPELINE = ['planning', 'in-progress', 'review', 'changes-requested', 'testing']
  // General boards have no pipeline stages — only show when an agent is actively running.
  // For research/coding boards, also show while transitioning between pipeline stages.
  const showProgressBar = isAgentRunning || (boardType !== 'general' && MID_PIPELINE.includes(task.status))

  const showAssignResearcher = task.status === 'backlog' && boardType !== 'general'
  const showAssignCoder = boardType === 'coding' && ((task.status === 'planning' && !isAgentRunning) || task.status === 'changes-requested')
  const showAssignSeniorCoder = boardType === 'coding' && task.status === 'in-progress' && !isAgentRunning
  const showAssignTester = boardType === 'coding' && task.status === 'testing' && !isAgentRunning

  const hasAssignAction = showAssignResearcher || showAssignCoder || showAssignSeniorCoder || showAssignTester

  const hasBottomMeta =
    (activeAgent && (isAgentRunning || activeAgent.status === 'done' || activeAgent.status === 'failed'))

  // Fallback token estimation: when live stats haven't arrived yet
  // (e.g. agent predates this feature, or stats were cleared on reset),
  // approximate output tokens from streamed event text (~4 chars per token).
  // Displayed with a "~" prefix to signal it's an estimate, not a CLI measurement.
  // Wrapped in useMemo so the .reduce() over potentially large event arrays only
  // re-runs when stats availability or the events array reference changes, not
  // on every SSE heartbeat tick that causes the parent to re-render.
  const approxOutputTokens = useMemo(() => {
    if (activeAgent?.stats || !activeAgent?.events?.length) return 0
    return Math.round(
      activeAgent.events.reduce((sum, e) => sum + e.text.length, 0) / 4
    )
  }, [activeAgent?.stats, activeAgent?.events])

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

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => {
            // Check pipeline-generated colors first, then project tag definitions
            const pipelineClass = TAG_COLORS[tag]
            const projectTag = !pipelineClass ? projectTags?.find((t) => t.name === tag) : undefined
            if (pipelineClass) {
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${pipelineClass}`}
                >
                  {tag}
                </span>
              )
            }
            if (projectTag) {
              return (
                <span
                  key={tag}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  style={{
                    background: projectTag.color + '33',
                    color: projectTag.color,
                    borderColor: projectTag.color + '55',
                  }}
                >
                  {tag}
                </span>
              )
            }
            return (
              <span
                key={tag}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${TAG_COLOR_DEFAULT}`}
              >
                {tag}
              </span>
            )
          })}
        </div>
      )}

      {/* File attachment count badge — compact pill shown below description.
          preloadedCount comes from task.fileCount in the SSE stream, so no
          per-card HTTP fetch is needed on initial board load. */}
      <FileAttachmentList
        taskId={task.id}
        variant="compact"
        preloadedCount={task.fileCount ?? 0}
      />

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

      {(hasBottomMeta || showProgressBar) && (
        <div className="pt-1.5 mt-1.5 border-t border-dracula-dark/40 space-y-1.5">
          {showProgressBar && (
            <AgentProgressBar task={task} activeAgent={activeAgent} boardType={boardType} />
          )}

          {/* Fallback estimated stats — shown when live stats are unavailable
              but the agent has produced output we can estimate tokens from */}
          {!activeAgent?.stats && approxOutputTokens > 0 && (
            <div className="flex items-center gap-x-1.5">
              <span className="text-[10px] text-dracula-comment/70" title="Estimated from output length">
                ~{formatTokens(approxOutputTokens)} tokens
              </span>
            </div>
          )}

          {/* Stats row — shown whenever the agent has emitted any token data */}
          {activeAgent?.stats && (activeAgent.stats.totalTokens > 0 || activeAgent.stats.inputTokens > 0) && (
            <div className="flex items-center gap-x-2 flex-wrap gap-y-0.5">
              <span className="text-[10px] text-dracula-comment">
                {formatTokens(activeAgent.stats.inputTokens)} in
              </span>
              <span className="text-[10px] text-dracula-comment">·</span>
              <span className="text-[10px] text-dracula-comment">
                {formatTokens(activeAgent.stats.outputTokens)} out
              </span>
              <span className="text-[10px] text-dracula-comment">·</span>
              <span className="text-[10px] text-dracula-blue font-medium">
                {formatTokens(activeAgent.stats.totalTokens)} tokens
              </span>
              {activeAgent.stats.numTurns > 0 && (
                <>
                  <span className="text-[10px] text-dracula-comment">·</span>
                  <span className="text-[10px] text-dracula-comment">
                    {activeAgent.stats.numTurns} {activeAgent.stats.numTurns === 1 ? 'turn' : 'turns'}
                  </span>
                </>
              )}
              {activeAgent.stats.costUsd != null && activeAgent.stats.costUsd > 0 && (
                <>
                  <span className="text-[10px] text-dracula-comment">·</span>
                  <span className="text-[10px] text-dracula-green">
                    {formatCost(activeAgent.stats.costUsd)}
                  </span>
                </>
              )}
              {activeAgent.stats.model && (
                <span
                  className="text-[10px] text-dracula-comment/70 truncate max-w-[100px]"
                  title={activeAgent.stats.model}
                >
                  {activeAgent.stats.model}
                </span>
              )}
            </div>
          )}

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
      {/*
        FileDropZone wraps the dnd-kit draggable div.
        It only intercepts native HTML5 file drops (checks dataTransfer.types includes 'Files'),
        so dnd-kit card-drag events pass through unaffected.
      */}
      <FileDropZone
        taskId={task.id}
        variant="compact"
        onUploaded={refreshFiles}
      >
        <div
          ref={setNodeRef}
          style={style}
          {...listeners}
          {...attributes}
          onClick={() => setModalOpen(true)}
          className={`relative group rounded-lg border bg-dracula-dark shadow-sm p-3 hover:border-dracula-purple/40 hover:shadow-md transition-all cursor-pointer ${isDragging ? 'opacity-40' : ''} ${isSelected ? 'border-dracula-purple/60 ring-1 ring-dracula-purple/30' : 'border-dracula-dark/60'}`}
        >
          {onToggleSelect && (
            <div
              className={`absolute top-2 left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              onClick={(e) => { e.stopPropagation(); onToggleSelect(task.id) }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                className="w-4 h-4 accent-dracula-purple cursor-pointer"
              />
            </div>
          )}
          {cardContent}
        </div>
      </FileDropZone>
      {modalOpen && (
        <TaskDetailModal
          task={task}
          onClose={() => setModalOpen(false)}
          runs={runs}
          runsLoading={runsLoading}
          files={files}
          onFilesRefresh={refreshFiles}
        />
      )}
    </>
  )
}
