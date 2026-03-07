'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Task, Agent } from '@/lib/types'
import { StatusBadge } from '@/components/StatusBadge'

type AssignRole = 'researcher' | 'coder' | 'senior-coder'

interface KanbanCardProps {
  task: Task
  activeAgent?: Agent
}

export function KanbanCard({ task, activeAgent }: KanbanCardProps) {
  const [loading, setLoading] = useState<AssignRole | null>(null)

  async function assign(role: AssignRole) {
    setLoading(role)
    try {
      await fetch(`/api/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
    } finally {
      setLoading(null)
    }
  }

  const isAgentRunning = activeAgent?.status === 'running' || activeAgent?.status === 'queued'

  // Determine which action buttons to show based on status
  const showAssignResearcher = task.status === 'backlog'
  const showAssignCoder =
    (task.status === 'planning' && !isAgentRunning) ||
    task.status === 'changes-requested'
  const showAssignSeniorCoder =
    task.status === 'in-progress' && !isAgentRunning

  return (
    <div className="rounded-lg border border-dracula-dark bg-dracula-darker p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-dracula-light leading-snug">{task.title}</p>
        {activeAgent && <StatusBadge status={activeAgent.status} />}
      </div>

      {task.description && (
        <p className="text-xs text-dracula-blue line-clamp-2">{task.description}</p>
      )}

      {task.reviewNotes && task.status === 'changes-requested' && (
        <div className="rounded bg-dracula-red/10 border border-dracula-red/30 p-2">
          <p className="text-xs text-dracula-red font-medium mb-1">Review Notes</p>
          <p className="text-xs text-dracula-light/80 line-clamp-3">{task.reviewNotes}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {showAssignResearcher && (
          <ActionButton
            onClick={() => assign('researcher')}
            loading={loading === 'researcher'}
            color="cyan"
          >
            Assign Researcher
          </ActionButton>
        )}
        {showAssignCoder && (
          <ActionButton
            onClick={() => assign('coder')}
            loading={loading === 'coder'}
            color="green"
          >
            Assign Coder
          </ActionButton>
        )}
        {showAssignSeniorCoder && (
          <ActionButton
            onClick={() => assign('senior-coder')}
            loading={loading === 'senior-coder'}
            color="orange"
          >
            Assign Senior Coder
          </ActionButton>
        )}
        {activeAgent && (activeAgent.status === 'done' || activeAgent.status === 'failed') && (
          <Link
            href={`/agents/${activeAgent.id}`}
            className="text-xs text-dracula-cyan hover:text-dracula-light underline"
          >
            View Output
          </Link>
        )}
      </div>
    </div>
  )
}

function ActionButton({
  onClick,
  loading,
  color,
  children,
}: {
  onClick: () => void
  loading: boolean
  color: 'cyan' | 'green' | 'orange'
  children: React.ReactNode
}) {
  const colorClass = {
    cyan: 'bg-dracula-cyan/15 text-dracula-cyan hover:bg-dracula-cyan/25 border-dracula-cyan/30',
    green: 'bg-dracula-green/15 text-dracula-green hover:bg-dracula-green/25 border-dracula-green/30',
    orange: 'bg-dracula-orange/15 text-dracula-orange hover:bg-dracula-orange/25 border-dracula-orange/30',
  }[color]

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded px-2 py-1 text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
    >
      {loading ? 'Assigning...' : children}
    </button>
  )
}
