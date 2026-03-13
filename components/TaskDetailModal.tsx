'use client'

import { useState, useEffect } from 'react'
import { Task, TaskStatus, TaskRun } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { MarkdownOutput } from '@/components/ui/MarkdownOutput'
import { FileDropZone } from '@/components/FileDropZone'
import { FileAttachmentList } from '@/components/FileAttachmentList'
import { formatDuration, formatElapsed, formatTokens, formatCost } from '@/lib/format-utils'
import { ROLE_COLORS, ROLE_COLOR_FALLBACK } from '@/lib/constants'
import { getModelPricing } from '@/lib/pricing'

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

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Returns the per-MTok input rate for a model, or undefined if unknown. */
function getInputRate(model: string): number | undefined {
  return getModelPricing(model)?.inputPerMTok
}

/** Returns the per-MTok output rate for a model, or undefined if unknown. */
function getOutputRate(model: string): number | undefined {
  return getModelPricing(model)?.outputPerMTok
}

interface TaskDetailModalProps {
  task: Task
  onClose: () => void
}

type Tab = 'details' | 'results'

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>(task.status === 'done' ? 'results' : 'details')
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [tags, setTags] = useState<string[]>(task.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [runs, setRuns] = useState<TaskRun[]>([])
  const [runsLoading, setRunsLoading] = useState(true)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [fileRefreshKey, setFileRefreshKey] = useState(0)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const controller = new AbortController()
    setRunsLoading(true)
    fetch(`/api/tasks/${task.id}/runs`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: TaskRun[]) => setRuns(data))
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') throw e
      })
      .finally(() => setRunsLoading(false))
    return () => controller.abort()
  }, [task.id])

  async function save() {
    const tagsChanged = JSON.stringify(tags) !== JSON.stringify(task.tags ?? [])
    if (title === task.title && description === task.description && !tagsChanged) {
      onClose()
      return
    }
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, tags }),
    })
    onClose()
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().slice(0, 32)
    if (!t || tags.includes(t)) { setTagInput(''); return }
    setTags((prev) => [...prev, t])
    setTagInput('')
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag))
  }

  const totalTimeMs = runs.reduce((sum, r) => sum + (r.completedAt - r.startedAt), 0)
  const totalTokens = runs.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0)
  const totalCost = runs.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-dracula-darker rounded-xl border border-dracula-dark/60 w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-dracula-dark/40 pb-3">
          <button
            onClick={() => setActiveTab('details')}
            className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${activeTab === 'details' ? 'bg-dracula-purple/20 text-dracula-purple' : 'text-dracula-comment hover:text-dracula-light'}`}
          >
            Details
          </button>
          {task.status === 'done' && (
            <button
              onClick={() => setActiveTab('results')}
              className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${activeTab === 'results' ? 'bg-dracula-green/20 text-dracula-green' : 'text-dracula-comment hover:text-dracula-light'}`}
            >
              Results
            </button>
          )}
        </div>

        {activeTab === 'details' && (
          <>
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

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
                Tags
              </label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-dracula-purple/20 text-dracula-purple border border-dracula-purple/30"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-dracula-red transition-colors leading-none"
                        aria-label={`Remove tag ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-dracula-dark border border-dracula-dark/80 rounded-lg px-3 py-1.5 text-sm text-dracula-light placeholder-dracula-comment focus:outline-none focus:border-dracula-purple/60 transition-colors"
                  placeholder="Add a tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                />
                <button
                  onClick={addTag}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-dracula-purple/20 text-dracula-purple hover:bg-dracula-purple/30 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* ----------------------------------------------------------------
                Files / Attachments section
                FileAttachmentList shows existing files; FileDropZone lets user
                drag-and-drop or browse for new ones.
            ---------------------------------------------------------------- */}
            <div className="space-y-1 pt-1 border-t border-dracula-dark/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment pt-3">
                Attachments
              </p>
              <FileAttachmentList
                taskId={task.id}
                variant="full"
                refreshKey={fileRefreshKey}
              />
              <FileDropZone
                taskId={task.id}
                variant="full"
                onUploaded={() => setFileRefreshKey((k) => k + 1)}
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

            {/* Run History */}
            <div className="space-y-2 pt-2 border-t border-dracula-dark/40">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
                  Run History
                </p>
                {runs.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className="text-xs text-dracula-blue">
                      {formatElapsed(totalTimeMs)}
                    </span>
                    {totalTokens > 0 && (
                      <>
                        <span className="text-xs text-dracula-comment">·</span>
                        <span className="text-xs text-dracula-purple font-medium">
                          {formatTokens(totalTokens)} tokens
                        </span>
                      </>
                    )}
                    {totalCost > 0 && (
                      <>
                        <span className="text-xs text-dracula-comment">·</span>
                        <span className="text-xs text-dracula-green">
                          {formatCost(totalCost)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {runsLoading ? (
                <p className="text-xs text-dracula-blue">Loading…</p>
              ) : runs.length === 0 ? (
                <p className="text-xs text-dracula-comment">No runs yet.</p>
              ) : (
                <div className="space-y-1">
                  {runs.map((run) => (
                    <div key={run.id} className="rounded-lg border border-dracula-dark/60 overflow-hidden">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-dracula-dark/40 transition-colors flex-wrap"
                        onClick={() => setExpandedRunId(expandedRunId === run.id ? null : run.id)}
                      >
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${ROLE_COLORS[run.role] ?? ROLE_COLOR_FALLBACK}`}>
                          {run.role}
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${run.status === 'done' ? 'text-dracula-green bg-dracula-green/10' : 'text-dracula-red bg-dracula-red/10'}`}>
                          {run.status}
                        </span>
                        {/* Token stats — shown when available */}
                        {run.totalTokens != null && run.totalTokens > 0 && (
                          <span className="text-[10px] text-dracula-blue">
                            {formatTokens(run.totalTokens)} tokens
                          </span>
                        )}
                        {run.costUsd != null && run.costUsd > 0 && (
                          <span className="text-[10px] text-dracula-green">
                            {formatCost(run.costUsd)}
                          </span>
                        )}
                        <span className="text-xs text-dracula-blue ml-auto shrink-0">
                          {formatDuration(run.startedAt, run.completedAt)}
                        </span>
                        <span className="text-xs text-dracula-comment shrink-0">
                          {formatDate(run.completedAt)}
                        </span>
                        <span className="inline-flex items-center text-xs text-dracula-blue/60 ml-1 shrink-0">
                          <svg
                            className={`w-3 h-3 transition-transform${expandedRunId === run.id ? ' rotate-180' : ''}`}
                            viewBox="0 0 8 8"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <polygon points="0,0 8,0 4,7" />
                          </svg>
                        </span>
                      </button>
                      {expandedRunId === run.id && (
                        <div className="border-t border-dracula-dark/40 px-3 py-2 space-y-2">
                          {/* Detailed token breakdown */}
                          {(run.inputTokens != null || run.numTurns != null || run.model) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 py-1 border-b border-dracula-dark/30">
                              {run.inputTokens != null && (
                                <span className="text-[10px] text-dracula-comment">
                                  <span className="text-dracula-light">{formatTokens(run.inputTokens)}</span> in
                                </span>
                              )}
                              {run.outputTokens != null && (
                                <span className="text-[10px] text-dracula-comment">
                                  <span className="text-dracula-light">{formatTokens(run.outputTokens)}</span> out
                                </span>
                              )}
                              {run.numTurns != null && (
                                <span className="text-[10px] text-dracula-comment">
                                  <span className="text-dracula-light">{run.numTurns}</span>{' '}
                                  {run.numTurns === 1 ? 'turn' : 'turns'}
                                </span>
                              )}
                              {/* Cost breakdown: show input + output split when both token counts available */}
                              {run.costUsd != null && run.costUsd > 0 && run.inputTokens != null && run.outputTokens != null && run.model && (
                                <span
                                  className="text-[10px] text-dracula-green cursor-help"
                                  title={`Input: ${formatCost((run.inputTokens / 1_000_000) * (getInputRate(run.model) ?? 0))} · Output: ${formatCost((run.outputTokens / 1_000_000) * (getOutputRate(run.model) ?? 0))}`}
                                >
                                  {formatCost(run.costUsd)} total
                                </span>
                              )}
                              {run.model && (
                                <span className="text-[10px] text-dracula-comment/70 truncate max-w-[160px]" title={run.model}>
                                  {run.model}
                                </span>
                              )}
                            </div>
                          )}
                          <MarkdownOutput
                            output={run.output || '(no output)'}
                            className="max-h-48"
                          />
                          {run.error && (
                            <p className="mt-2 text-xs text-dracula-red font-mono">{run.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'results' && (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment">
              Final Implementation
            </p>
            {task.coderOutput ? (
              <MarkdownOutput output={task.coderOutput} className="max-h-[60vh]" />
            ) : (
              <p className="text-xs text-dracula-comment">No implementation output yet.</p>
            )}
          </div>
        )}

        {/* Actions — always visible */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          {activeTab === 'details' && (
            <Button variant="primary" size="md" onClick={save}>
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
