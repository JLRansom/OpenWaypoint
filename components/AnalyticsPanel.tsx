'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { ProjectAnalyticsResponse, TaskStatus } from '@/lib/types'
import { formatCost, formatElapsed } from '@/lib/format-utils'
import { ROLE_HEX, ROLE_COLORS, ROLE_COLOR_FALLBACK } from '@/lib/constants'

const AnalyticsCharts = dynamic(() => import('@/components/AnalyticsCharts').then((m) => ({ default: m.AnalyticsCharts })), { ssr: false })

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------
type TimeRange = '7d' | '30d' | '90d' | 'all'

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Last 7 days',  value: '7d'  },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
  { label: 'All time',     value: 'all' },
]

function getBounds(range: TimeRange): { from?: number; to?: number } {
  if (range === 'all') return {}
  const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }
  return { from: Date.now() - daysMap[range] * 86_400_000 }
}

// ---------------------------------------------------------------------------
// Pipeline status ordering + display config
// ---------------------------------------------------------------------------
const PIPELINE_STATUSES: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog',            label: 'Backlog',      color: 'text-dracula-comment bg-dracula-comment/10' },
  { status: 'planning',           label: 'Planning',     color: 'text-dracula-cyan    bg-dracula-cyan/10'    },
  { status: 'in-progress',        label: 'In Progress',  color: 'text-dracula-orange  bg-dracula-orange/10'  },
  { status: 'review',             label: 'Review',       color: 'text-dracula-purple  bg-dracula-purple/10'  },
  { status: 'testing',            label: 'Testing',      color: 'text-dracula-pink    bg-dracula-pink/10'    },
  { status: 'changes-requested',  label: 'Changes',      color: 'text-dracula-red     bg-dracula-red/10'     },
  { status: 'done',               label: 'Done',         color: 'text-dracula-green   bg-dracula-green/10'   },
]

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------
function timeAgo(epochMs: number): string {
  const diffMs = Date.now() - epochMs
  const diffSecs = Math.floor(diffMs / 1000)
  if (diffSecs < 60) return `${diffSecs}s ago`
  const diffMins = Math.floor(diffSecs / 60)
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// ---------------------------------------------------------------------------
// Summary stat card
// ---------------------------------------------------------------------------
function StatCard({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor: string
}) {
  return (
    <div className="bg-dracula-dark/60 rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function AnalyticsPanel({ projectId }: { projectId: string }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [data, setData] = useState<ProjectAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    const { from, to } = getBounds(timeRange)
    const params = new URLSearchParams()
    if (from !== undefined) params.set('from', String(from))
    if (to !== undefined) params.set('to', String(to))

    fetch(`/api/projects/${projectId}/analytics?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setLoading(false)
      })

    return () => controller.abort()
  }, [projectId, timeRange])

  const { summary } = data ?? {}
  const totalRuns = (summary?.totalRunsDone ?? 0) + (summary?.totalRunsFailed ?? 0)
  const hasRuns = totalRuns > 0

  // Build a status → count lookup from taskStatusCounts
  const statusCountMap = new Map<string, number>(
    (data?.taskStatusCounts ?? []).map(({ status, count }) => [status, count])
  )
  const hasAnyTasks = statusCountMap.size > 0

  return (
    <div className="space-y-6">
      {/* Time range pills */}
      <div className="flex gap-1">
        {TIME_RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setTimeRange(opt.value)}
            className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
              timeRange === opt.value
                ? 'bg-dracula-purple/20 text-dracula-purple'
                : 'text-dracula-comment hover:text-dracula-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-dracula-comment">Loading…</p>
      )}

      {!loading && (
        <>
          {/* ── 6 agent stat cards ── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Tasks Done"
              value={String(summary?.totalRunsDone ?? 0)}
              valueColor="text-dracula-green"
            />
            <StatCard
              label="Failed Runs"
              value={String(summary?.totalRunsFailed ?? 0)}
              valueColor="text-dracula-red"
            />
            <StatCard
              label="Active Tasks"
              value={String(summary?.activeTaskCount ?? 0)}
              valueColor="text-dracula-orange"
            />
            <StatCard
              label="Total Cost"
              value={formatCost(summary?.totalCostUsd ?? 0)}
              valueColor="text-dracula-orange"
            />
            <StatCard
              label="Avg Cost / Run"
              value={formatCost(summary?.avgCostPerRun ?? 0)}
              valueColor="text-dracula-purple"
            />
            <StatCard
              label="Success Rate"
              value={hasRuns ? `${Math.round(summary?.successRate ?? 0)}%` : '—'}
              valueColor="text-dracula-cyan"
            />
          </div>

          {/* ── 2 meeting stat cards ── */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Meetings Held"
              value={String(data?.meetingStats?.totalMeetings ?? 0)}
              valueColor="text-dracula-pink"
            />
            <StatCard
              label="Meeting Cost"
              value={formatCost(data?.meetingStats?.totalMeetingCostUsd ?? 0)}
              valueColor="text-dracula-pink"
            />
          </div>

          {/* ── Task pipeline strip ── */}
          {hasAnyTasks && (
            <div className="bg-dracula-dark/60 rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-3">Pipeline</p>
              <div className="flex items-center gap-1 flex-wrap">
                {PIPELINE_STATUSES.map((ps, i) => {
                  const count = statusCountMap.get(ps.status) ?? 0
                  return (
                    <div key={ps.status} className="flex items-center gap-1">
                      {i > 0 && <span className="text-dracula-comment/40 text-xs">→</span>}
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          count === 0 ? 'opacity-30' : ''
                        } ${ps.color}`}
                      >
                        {ps.label} ({count})
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!hasRuns && (
            <div className="text-sm text-dracula-comment space-y-1">
              <p>No runs in this time range.</p>
              {timeRange !== 'all' && (
                <button
                  onClick={() => setTimeRange('all')}
                  className="text-dracula-cyan hover:text-dracula-light transition-colors"
                >
                  View all time →
                </button>
              )}
            </div>
          )}

          {hasRuns && (
            <>
              {/* ── Two-column activity section ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Recent Runs */}
                <div className="bg-dracula-dark/60 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-3">Recent Runs</p>
                  <div className="space-y-2">
                    {(data?.recentRuns ?? []).slice(0, 10).map((run) => (
                      <div key={run.id} className="flex items-center gap-2 min-w-0">
                        {/* Status dot */}
                        <span
                          className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                            run.status === 'done' ? 'bg-dracula-green' : 'bg-dracula-red'
                          }`}
                        />
                        {/* Title */}
                        <span className="text-xs text-dracula-light truncate flex-1 min-w-0" title={run.taskTitle}>
                          {run.taskTitle}
                        </span>
                        {/* Role badge */}
                        <span
                          className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            ROLE_COLORS[run.role] ?? ROLE_COLOR_FALLBACK
                          }`}
                        >
                          {run.role}
                        </span>
                        {/* Cost */}
                        {run.costUsd !== undefined && (
                          <span className="shrink-0 text-[10px] text-dracula-orange tabular-nums">
                            {formatCost(run.costUsd)}
                          </span>
                        )}
                        {/* Duration */}
                        <span className="shrink-0 text-[10px] text-dracula-comment tabular-nums">
                          {formatElapsed(run.durationMs)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recently Updated Tasks */}
                <div className="bg-dracula-dark/60 rounded-xl p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-3">Recently Updated</p>
                  <div className="space-y-2">
                    {(data?.recentlyUpdatedTasks ?? []).map((task) => {
                      const ps = PIPELINE_STATUSES.find((p) => p.status === task.status)
                      return (
                        <div key={task.id} className="flex items-center gap-2 min-w-0">
                          {/* Status badge */}
                          <span
                            className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              ps?.color ?? 'text-dracula-light bg-dracula-dark'
                            }`}
                          >
                            {ps?.label ?? task.status}
                          </span>
                          {/* Title */}
                          <span className="text-xs text-dracula-light truncate flex-1 min-w-0" title={task.title}>
                            {task.title}
                          </span>
                          {/* Time ago */}
                          <span className="shrink-0 text-[10px] text-dracula-comment tabular-nums">
                            {timeAgo(task.updatedAt)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>

              {/* ── Charts (lazy-loaded) ── */}
              {data !== null && <AnalyticsCharts data={data} />}
            </>
          )}
        </>
      )}
    </div>
  )
}
