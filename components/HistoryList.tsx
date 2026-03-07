'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStream } from '@/components/StreamProvider'
import { StatusBadge } from '@/components/StatusBadge'
import { AgentType, AgentStatus } from '@/lib/types'

type TypeFilter = 'all' | AgentType
type StatusFilter = 'all' | 'done' | 'failed'

function formatDuration(createdAt: number, completedAt?: number): string {
  if (!completedAt) return '—'
  const seconds = Math.round((completedAt - createdAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function outputPreview(events: { text: string }[]): string {
  const full = events.map((e) => e.text).join('')
  return full.slice(0, 80) + (full.length > 80 ? '…' : '')
}

const TYPE_OPTIONS: { label: string; value: TypeFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Researcher', value: 'researcher' },
  { label: 'Coder', value: 'coder' },
  { label: 'Writer', value: 'writer' },
]

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Done', value: 'done' },
  { label: 'Failed', value: 'failed' },
]

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-dracula-purple text-dracula-darker'
          : 'bg-dracula-dark text-dracula-blue hover:text-dracula-light'
      }`}
    >
      {children}
    </button>
  )
}

export function HistoryList() {
  const agents = useStream()
  const router = useRouter()
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const completed = agents.filter(
    (a) => a.status === 'done' || a.status === 'failed'
  )

  const filtered = completed.filter((a) => {
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (statusFilter !== 'all' && a.status !== statusFilter) return false
    return true
  })

  async function handleRetry(type: AgentType, prompt: string) {
    await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, prompt }),
    })
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-dracula-blue mr-1">Type:</span>
          {TYPE_OPTIONS.map((o) => (
            <PillButton
              key={o.value}
              active={typeFilter === o.value}
              onClick={() => setTypeFilter(o.value)}
            >
              {o.label}
            </PillButton>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-dracula-blue mr-1">Status:</span>
          {STATUS_OPTIONS.map((o) => (
            <PillButton
              key={o.value}
              active={statusFilter === o.value}
              onClick={() => setStatusFilter(o.value)}
            >
              {o.label}
            </PillButton>
          ))}
        </div>
        <span className="ml-auto text-xs text-dracula-blue">
          {filtered.length} run{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-dracula-blue text-sm mt-8 text-center">
          No completed agents yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-dracula-dark">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dracula-dark bg-dracula-dark text-left text-xs text-dracula-blue uppercase tracking-wider">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Prompt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Output Preview</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((agent) => (
                <tr
                  key={agent.id}
                  className="border-b border-dracula-dark hover:bg-dracula-dark/30 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs text-dracula-blue">
                    {agent.id.slice(0, 8)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="rounded bg-dracula-dark px-2 py-0.5 text-xs font-medium text-dracula-light capitalize">
                      {agent.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-dracula-light">
                    {agent.prompt}
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={agent.status} />
                  </td>
                  <td className="py-3 px-4 text-xs text-dracula-blue">
                    {formatDuration(agent.createdAt, agent.completedAt)}
                  </td>
                  <td className="py-3 px-4 max-w-xs truncate text-xs text-dracula-light/70 italic">
                    {outputPreview(agent.events)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/agents/${agent.id}`)}
                        className="text-xs text-dracula-cyan hover:text-dracula-light"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleRetry(agent.type, agent.prompt)}
                        className="text-xs text-dracula-blue hover:text-dracula-light"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
