'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { TaskRun, PaginatedRunsResponse } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { MarkdownOutput } from '@/components/ui/MarkdownOutput'

type RoleFilter = 'all' | 'researcher' | 'coder' | 'senior-coder'
type StatusFilter = 'all' | 'done' | 'failed'

type TerminalEvent =
  | { kind: 'tool_use'; name: string; input: unknown }
  | { kind: 'tool_result'; content: string }

function parseTerminalEvents(rawLog: string): TerminalEvent[] {
  const events: TerminalEvent[] = []
  for (const line of rawLog.split('\n')) {
    try {
      const obj = JSON.parse(line)
      if (obj.type === 'assistant' && Array.isArray(obj.message?.content)) {
        for (const block of obj.message.content) {
          if (block.type === 'tool_use') {
            events.push({ kind: 'tool_use', name: block.name, input: block.input })
          }
        }
      }
      if (obj.type === 'tool_result') {
        const content = Array.isArray(obj.content)
          ? obj.content.map((c: { text?: string }) => c.text ?? '').join('')
          : String(obj.content ?? '')
        events.push({ kind: 'tool_result', content })
      }
    } catch {
      continue
    }
  }
  return events
}

function formatDuration(startedAt: number, completedAt: number): string {
  const seconds = Math.round((completedAt - startedAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const ROLE_OPTIONS: { label: string; value: RoleFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Researcher', value: 'researcher' },
  { label: 'Coder', value: 'coder' },
  { label: 'Senior Coder', value: 'senior-coder' },
]

const STATUS_OPTIONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Done', value: 'done' },
  { label: 'Failed', value: 'failed' },
]

const ROLE_COLORS: Record<string, string> = {
  researcher: 'text-dracula-cyan bg-dracula-cyan/10',
  coder: 'text-dracula-green bg-dracula-green/10',
  'senior-coder': 'text-dracula-orange bg-dracula-orange/10',
  writer: 'text-dracula-purple bg-dracula-purple/10',
  tester: 'text-dracula-pink bg-dracula-pink/10',
}

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

const LIMIT = 20

export function HistoryList() {
  const router = useRouter()
  const [runs, setRuns] = useState<TaskRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<'result' | 'terminal'>('result')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState<number | undefined>()
  const [dateTo, setDateTo] = useState<number | undefined>()

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(LIMIT))
      if (roleFilter !== 'all') params.set('role', roleFilter)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search.trim()) params.set('q', search.trim())
      if (dateFrom !== undefined) params.set('from', String(dateFrom))
      if (dateTo !== undefined) params.set('to', String(dateTo))

      const res = await fetch(`/api/runs?${params}`)
      const data: PaginatedRunsResponse = await res.json()
      setRuns(data.runs)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } finally {
      setLoading(false)
    }
  }, [page, roleFilter, statusFilter, search, dateFrom, dateTo])

  useEffect(() => { fetchRuns() }, [fetchRuns])
  useEffect(() => { setExpandedTab('result') }, [expandedId])

  // Debounce searchInput → search (300ms)
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  // Reset page to 1 when filters change
  useEffect(() => { setPage(1) }, [roleFilter, statusFilter, search, dateFrom, dateTo])

  // Collapse expanded row on page change
  useEffect(() => { setExpandedId(null) }, [page])

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-dracula-blue mr-1">Role:</span>
          {ROLE_OPTIONS.map((o) => (
            <PillButton key={o.value} active={roleFilter === o.value} onClick={() => setRoleFilter(o.value)}>
              {o.label}
            </PillButton>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-dracula-blue mr-1">Status:</span>
          {STATUS_OPTIONS.map((o) => (
            <PillButton key={o.value} active={statusFilter === o.value} onClick={() => setStatusFilter(o.value)}>
              {o.label}
            </PillButton>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-dracula-blue mr-1">From:</span>
          <input
            type="date"
            value={dateFrom !== undefined ? new Date(dateFrom).toISOString().slice(0, 10) : ''}
            onChange={(e) => {
              setDateFrom(e.target.value ? new Date(e.target.value).getTime() : undefined)
            }}
            className="rounded-lg bg-dracula-dark border border-dracula-dark/80 px-2 py-1 text-xs text-dracula-light focus:outline-none focus:border-dracula-purple/60"
          />
          <span className="text-xs text-dracula-blue">To:</span>
          <input
            type="date"
            value={dateTo !== undefined ? new Date(dateTo - 86399999).toISOString().slice(0, 10) : ''}
            onChange={(e) => {
              setDateTo(e.target.value ? new Date(e.target.value).getTime() + 86399999 : undefined)
            }}
            className="rounded-lg bg-dracula-dark border border-dracula-dark/80 px-2 py-1 text-xs text-dracula-light focus:outline-none focus:border-dracula-purple/60"
          />
        </div>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search tasks, projects, and logs…"
          className="ml-2 rounded-lg bg-dracula-dark border border-dracula-dark/80 px-3 py-1 text-xs text-dracula-light placeholder-dracula-comment focus:outline-none focus:border-dracula-purple/60"
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-dracula-blue">
            {total} run{total !== 1 ? 's' : ''}
          </span>
          {(roleFilter !== 'all' || statusFilter !== 'all' || searchInput || dateFrom !== undefined || dateTo !== undefined) && (
            <button
              onClick={() => {
                setRoleFilter('all')
                setStatusFilter('all')
                setSearchInput('')
                setSearch('')
                setDateFrom(undefined)
                setDateTo(undefined)
                setPage(1)
              }}
              className="text-xs text-dracula-red hover:text-dracula-red/80 transition-colors"
            >
              Clear all
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={fetchRuns}>
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-dracula-blue text-sm mt-8 text-center">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-dracula-blue text-sm mt-8 text-center">
          {roleFilter !== 'all' || statusFilter !== 'all' || search || dateFrom !== undefined || dateTo !== undefined
            ? 'No runs match your filters.'
            : 'No runs yet.'}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-dracula-dark">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dracula-dark bg-dracula-dark text-left text-xs text-dracula-blue uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Task</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <React.Fragment key={run.id}>
                    <tr
                      className="border-b border-dracula-dark hover:bg-dracula-dark/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
                    >
                      <td className="py-3 px-4 text-xs text-dracula-comment whitespace-nowrap">
                        {formatDate(run.completedAt)}
                      </td>
                      <td className="py-3 px-4 max-w-[180px] truncate text-dracula-light">
                        {run.taskTitle}
                      </td>
                      <td className="py-3 px-4 max-w-[140px] truncate text-dracula-comment">
                        {run.projectName}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[run.role] ?? 'text-dracula-light bg-dracula-dark'}`}>
                          {run.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${run.status === 'done' ? 'text-dracula-green bg-dracula-green/10' : 'text-dracula-red bg-dracula-red/10'}`}>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-dracula-blue whitespace-nowrap">
                        {formatDuration(run.startedAt, run.completedAt)}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/projects/${run.projectId}?card=${run.taskId}`)
                          }}
                          className="whitespace-nowrap"
                        >
                          Go to Card
                        </Button>
                      </td>
                    </tr>
                    {expandedId === run.id && (
                      <tr className="border-b border-dracula-dark bg-dracula-darker">
                        <td colSpan={7} className="px-4 py-3">
                          {/* Tab bar */}
                          <div className="flex gap-1 mb-3 border-b border-dracula-dark pb-2">
                            {(['result', 'terminal'] as const).map((tab) => (
                              <button
                                key={tab}
                                onClick={() => setExpandedTab(tab)}
                                className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${
                                  expandedTab === tab
                                    ? 'bg-dracula-purple text-dracula-darker'
                                    : 'text-dracula-blue hover:text-dracula-light'
                                }`}
                              >
                                {tab === 'result' ? 'Result' : 'Terminal'}
                              </button>
                            ))}
                          </div>

                          {/* Result tab */}
                          {expandedTab === 'result' && (
                            <MarkdownOutput
                              output={run.output || '(no output)'}
                              className="max-h-64 bg-dracula-dark rounded p-3"
                            />
                          )}

                          {/* Terminal tab */}
                          {expandedTab === 'terminal' && (
                            <div className="max-h-64 overflow-y-auto bg-dracula-darker rounded p-3 font-mono text-xs space-y-2">
                              {!run.rawLog ? (
                                <span className="text-dracula-comment italic">
                                  No terminal log available for this run.
                                </span>
                              ) : (
                                parseTerminalEvents(run.rawLog).map((ev, i) =>
                                  ev.kind === 'tool_use' ? (
                                    <div key={i}>
                                      <span className="text-dracula-green font-semibold">
                                        {'> '}{ev.name}
                                      </span>
                                      {ev.input != null && (
                                        <pre className="mt-0.5 ml-4 text-dracula-yellow whitespace-pre-wrap break-all">
                                          {JSON.stringify(ev.input as Record<string, unknown>, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  ) : (
                                    <pre key={i} className="ml-4 text-dracula-comment whitespace-pre-wrap break-all border-l-2 border-dracula-dark pl-2">
                                      {ev.content || '(empty)'}
                                    </pre>
                                  )
                                )
                              )}
                            </div>
                          )}

                          {run.error && (
                            <p className="mt-2 text-xs text-dracula-red font-mono">{run.error}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Previous
              </Button>
              <span className="text-xs text-dracula-blue">
                Page {page} of {totalPages} · {total} total run{total !== 1 ? 's' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
