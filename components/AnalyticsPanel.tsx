'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { ProjectAnalyticsResponse, TaskStatus, MeetingsByDayData } from '@/lib/types'
import { formatTokens, formatCost, formatElapsed } from '@/lib/format-utils'
import { ROLE_HEX, ROLE_HEX_FALLBACK, ROLE_COLORS, ROLE_COLOR_FALLBACK } from '@/lib/constants'

// ---------------------------------------------------------------------------
// Dracula hex palette for Recharts SVG props (Tailwind classes don't work here)
// ---------------------------------------------------------------------------
const D = {
  green:   '#50fa7b',
  red:     '#ff5555',
  cyan:    '#8be9fd',
  purple:  '#bd93f9',
  orange:  '#ffb86c',
  pink:    '#ff79c6',
  comment: '#6272a4',
  dark:    '#44475a',
  darker:  '#282a36',
  light:   '#f8f8f2',
}

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
// Shared chart axis / grid style props
// ---------------------------------------------------------------------------
const axisStyle = {
  tick: { fill: D.comment, fontSize: 11 },
  tickLine: false as const,
  axisLine: { stroke: D.dark },
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: D.darker,
    border: `1px solid ${D.dark}`,
    borderRadius: 8,
    color: D.light,
    fontSize: 12,
  },
  itemStyle: { color: D.light },
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
// Chart wrapper card
// ---------------------------------------------------------------------------
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-dracula-dark/60 rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-3">{title}</p>
      {children}
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
    let cancelled = false
    setLoading(true)

    const { from, to } = getBounds(timeRange)
    const params = new URLSearchParams()
    if (from !== undefined) params.set('from', String(from))
    if (to !== undefined) params.set('to', String(to))

    fetch(`/api/projects/${projectId}/analytics?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
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

              {/* ── Charts grid 2×2 ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Weekly tasks done vs failed */}
                <ChartCard title="Tasks Completed per Week">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data!.weeklyTasks} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={D.dark} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="weekLabel" {...axisStyle} />
                      <YAxis allowDecimals={false} {...axisStyle} />
                      <Tooltip {...tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, color: D.comment }} />
                      <Bar dataKey="done"   name="Done"   fill={D.green} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="failed" name="Failed" fill={D.red}   radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Daily token usage */}
                <ChartCard title="Token Usage over Time">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data!.dailyTokens} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={D.dark} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" {...axisStyle} />
                      <YAxis tickFormatter={(v: number) => formatTokens(v)} {...axisStyle} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => formatTokens(Number(value))}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: D.comment }} />
                      <Line
                        type="monotone"
                        dataKey="inputTokens"
                        name="Input"
                        stroke={D.cyan}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="outputTokens"
                        name="Output"
                        stroke={D.purple}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Cumulative cost over time */}
                <ChartCard title="Cumulative Cost over Time">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data!.dailyCost} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={D.orange} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={D.orange} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={D.dark} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" {...axisStyle} />
                      <YAxis tickFormatter={(v: number) => formatCost(v)} {...axisStyle} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [formatCost(Number(value)), 'Cumulative Cost']}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulativeCost"
                        name="Cost"
                        stroke={D.orange}
                        strokeWidth={2}
                        fill="url(#costGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartCard>

                {/* Cost by role — horizontal bar chart */}
                <ChartCard title="Cost by Agent Role">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      layout="vertical"
                      data={data!.costByRole}
                      margin={{ top: 4, right: 8, left: 40, bottom: 0 }}
                    >
                      <CartesianGrid stroke={D.dark} strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => formatCost(v)}
                        {...axisStyle}
                      />
                      <YAxis type="category" dataKey="role" {...axisStyle} width={70} />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value) => [formatCost(Number(value)), 'Cost']}
                      />
                      <Bar dataKey="totalCost" name="Cost" radius={[0, 3, 3, 0]}>
                        {data!.costByRole.map((entry) => (
                          <Cell
                            key={entry.role}
                            fill={ROLE_HEX[entry.role] ?? ROLE_HEX_FALLBACK}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

              </div>

              {/* ── Meetings over time chart ── */}
              {(data?.meetingStats?.meetingsByDay?.length ?? 0) > 0 && (
                <ChartCard title="Meetings Over Time">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={data!.meetingStats!.meetingsByDay as MeetingsByDayData[]}
                      margin={{ top: 4, right: 32, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid stroke={D.dark} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dateLabel" {...axisStyle} />
                      <YAxis yAxisId="count" allowDecimals={false} {...axisStyle} />
                      <YAxis
                        yAxisId="cost"
                        orientation="right"
                        tickFormatter={(v: number) => formatCost(v)}
                        {...axisStyle}
                      />
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(value, name) =>
                          name === 'Cost' ? [formatCost(Number(value)), 'Cost'] : [String(value), name]
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: D.comment }} />
                      <Bar yAxisId="count" dataKey="count" name="Meetings" fill={D.pink} radius={[3, 3, 0, 0]} />
                      <Line
                        yAxisId="cost"
                        type="monotone"
                        dataKey="costUsd"
                        name="Cost"
                        stroke={D.orange}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
