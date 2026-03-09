'use client'

import { useState, useEffect } from 'react'
import { Task, Agent, BoardType, AgentType } from '@/lib/types'

interface AgentProgressBarProps {
  task: Task
  activeAgent?: Agent
  boardType: BoardType
}

interface PipelineStage {
  label: string
  /** Full Tailwind bg-* class */
  color: string
}

const CODING_PIPELINE: PipelineStage[] = [
  { label: 'Research', color: 'bg-dracula-cyan' },
  { label: 'Code',     color: 'bg-dracula-green' },
  { label: 'Review',   color: 'bg-dracula-orange' },
  { label: 'Test',     color: 'bg-dracula-pink' },
]

const RESEARCH_PIPELINE: PipelineStage[] = [
  { label: 'Research', color: 'bg-dracula-cyan' },
]

const ROLE_TEXT_COLOR: Record<AgentType, string> = {
  researcher:    'text-dracula-cyan',
  coder:         'text-dracula-green',
  'senior-coder':'text-dracula-orange',
  tester:        'text-dracula-pink',
  writer:        'text-dracula-purple',
}

const ROLE_LABEL: Record<AgentType, string> = {
  researcher:    'Researcher',
  coder:         'Coder',
  'senior-coder':'Senior Coder',
  tester:        'Tester',
  writer:        'Writer',
}

/**
 * Map task status + active agent onto a { completedCount, activeIndex } pair
 * for a 4-stage coding pipeline: Research(0) → Code(1) → Review(2) → Test(3)
 *
 * completedCount = number of stages that are fully done (solid fill, no animation)
 * activeIndex    = index of the stage currently being worked on (-1 = none)
 */
function getCodingProgress(
  task: Task,
  activeAgent?: Agent,
): { completedCount: number; activeIndex: number } {
  const isRunning = activeAgent?.status === 'running' || activeAgent?.status === 'queued'

  switch (task.status) {
    case 'planning':
      // Researcher is (or was) working
      return { completedCount: 0, activeIndex: isRunning ? 0 : -1 }
    case 'in-progress':
      // Research done; coder is (or was) working
      return { completedCount: 1, activeIndex: isRunning ? 1 : -1 }
    case 'review':
      // Research + code done; senior-coder is (or was) reviewing
      return { completedCount: 2, activeIndex: isRunning ? 2 : -1 }
    case 'changes-requested':
      // Review rejected; coder loops back to index 1
      return { completedCount: 1, activeIndex: isRunning ? 1 : -1 }
    case 'testing':
      // Research + code + review done; tester is running
      return { completedCount: 3, activeIndex: isRunning ? 3 : -1 }
    case 'done':
      return { completedCount: 4, activeIndex: -1 }
    default:
      return { completedCount: 0, activeIndex: -1 }
  }
}

function getResearchProgress(
  task: Task,
  activeAgent?: Agent,
): { completedCount: number; activeIndex: number } {
  const isRunning = activeAgent?.status === 'running' || activeAgent?.status === 'queued'
  if (task.status === 'done') return { completedCount: 1, activeIndex: -1 }
  return { completedCount: 0, activeIndex: isRunning ? 0 : -1 }
}

function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

export function AgentProgressBar({ task, activeAgent, boardType }: AgentProgressBarProps) {
  const [elapsed, setElapsed] = useState(0)

  const isRunning = activeAgent?.status === 'running' || activeAgent?.status === 'queued'

  useEffect(() => {
    if (!isRunning || !activeAgent?.createdAt) {
      setElapsed(0)
      return
    }
    setElapsed(Date.now() - activeAgent.createdAt)
    const id = setInterval(() => {
      setElapsed(Date.now() - activeAgent.createdAt)
    }, 1000)
    return () => clearInterval(id)
  }, [isRunning, activeAgent?.createdAt])

  // ── General boards ─────────────────────────────────────────────────────────
  // No pipeline stages — just show role chip + elapsed time while running.
  if (boardType === 'general') {
    if (!isRunning || !activeAgent) return null
    const textColor = ROLE_TEXT_COLOR[activeAgent.type] ?? 'text-dracula-light'
    const label     = ROLE_LABEL[activeAgent.type]     ?? activeAgent.type
    return (
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-medium ${textColor}`}>● {label} working…</span>
        {elapsed > 0 && (
          <span className="text-[10px] text-dracula-comment">{formatElapsed(elapsed)}</span>
        )}
      </div>
    )
  }

  // ── Research / Coding boards ────────────────────────────────────────────────
  const pipeline = boardType === 'research' ? RESEARCH_PIPELINE : CODING_PIPELINE
  const { completedCount, activeIndex } =
    boardType === 'research'
      ? getResearchProgress(task, activeAgent)
      : getCodingProgress(task, activeAgent)

  // Nothing to show yet (backlog with no active agent)
  if (completedCount === 0 && activeIndex === -1) return null

  // Build label
  let labelText  = ''
  let labelColor = 'text-dracula-comment'

  if (isRunning && activeAgent) {
    labelText  = `${ROLE_LABEL[activeAgent.type] ?? activeAgent.type} working…`
    labelColor = ROLE_TEXT_COLOR[activeAgent.type] ?? 'text-dracula-light'
  } else if (completedCount > 0 && completedCount < pipeline.length) {
    labelText  = 'Transitioning…'
    labelColor = 'text-dracula-comment'
  }

  return (
    <div className="space-y-1">
      {/* Segmented pipeline bar */}
      <div className="flex gap-0.5">
        {pipeline.map((stage, i) => {
          const isActive    = i === activeIndex
          const isCompleted = i < completedCount
          const bgClass     = isActive || isCompleted ? stage.color : 'bg-dracula-dark/40'
          return (
            <div
              key={stage.label}
              title={stage.label}
              className={`h-1 flex-1 rounded-full ${bgClass}${isActive ? ' animate-pulse' : ''}`}
            />
          )
        })}
      </div>

      {/* Role label + elapsed time */}
      {labelText && (
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-medium truncate ${labelColor}`}>{labelText}</span>
          {isRunning && elapsed > 0 && (
            <span className="text-[10px] text-dracula-comment shrink-0">{formatElapsed(elapsed)}</span>
          )}
        </div>
      )}
    </div>
  )
}
