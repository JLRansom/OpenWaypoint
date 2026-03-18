'use client'

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
import type { ProjectAnalyticsResponse, MeetingsByDayData } from '@/lib/types'
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
// AnalyticsCharts — all four recharts chart blocks
// ---------------------------------------------------------------------------
export function AnalyticsCharts({ data }: { data: ProjectAnalyticsResponse }) {
  return (
    <>
      {/* ── Charts grid 2×2 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Weekly tasks done vs failed */}
        <ChartCard title="Tasks Completed per Week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.weeklyTasks} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
            <LineChart data={data.dailyTokens} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
            <AreaChart data={data.dailyCost} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
              data={data.costByRole}
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
                {data.costByRole.map((entry) => (
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
      {(data.meetingStats?.meetingsByDay?.length ?? 0) > 0 && (
        <ChartCard title="Meetings Over Time">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data.meetingStats!.meetingsByDay as MeetingsByDayData[]}
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
  )
}
