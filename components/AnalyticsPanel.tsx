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
import type { ProjectAnalyticsResponse } from '@/lib/types'
import { formatTokens, formatCost } from '@/lib/format-utils'
import { ROLE_HEX, ROLE_HEX_FALLBACK } from '@/lib/constants'

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
  const hasData = totalRuns > 0

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

      {!loading && !hasData && (
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

      {!loading && hasData && summary && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Tasks Done"
              value={String(summary.totalRunsDone)}
              valueColor="text-dracula-green"
            />
            <StatCard
              label="Total Cost"
              value={formatCost(summary.totalCostUsd)}
              valueColor="text-dracula-orange"
            />
            <StatCard
              label="Total Tokens"
              value={formatTokens(summary.totalInputTokens + summary.totalOutputTokens)}
              valueColor="text-dracula-cyan"
            />
            <StatCard
              label="Avg Cost / Run"
              value={formatCost(summary.avgCostPerRun)}
              valueColor="text-dracula-purple"
            />
          </div>

          {/* Charts grid */}
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
        </>
      )}
    </div>
  )
}
