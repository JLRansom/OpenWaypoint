'use client'

import type { AgentHealthMetrics } from '@/lib/types'

interface Props {
  metrics: AgentHealthMetrics | undefined
}

// ---------------------------------------------------------------------------
// Threshold helpers — return a Tailwind color class based on the metric value
// ---------------------------------------------------------------------------

function completionColor(rate: number): string {
  if (rate >= 0.8) return 'bg-green-500'
  if (rate >= 0.5) return 'bg-yellow-400'
  return 'bg-red-500'
}

function trendColor(trend: number): string {
  if (trend > 0) return 'bg-green-500'
  if (trend < 0) return 'bg-red-500'
  return 'bg-dracula-comment'
}

function errorColor(density: number): string {
  if (density <= 0.05) return 'bg-green-500'
  if (density <= 0.2) return 'bg-yellow-400'
  return 'bg-red-500'
}

function idleColor(seconds: number): string {
  const hours = seconds / 3600
  if (hours < 1) return 'bg-green-500'
  if (hours < 4) return 'bg-yellow-400'
  return 'bg-red-500'
}

function formatIdle(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`
  return `${(seconds / 86400).toFixed(1)}d`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Compact four-dot health indicator for a single agent.
 * Renders nothing if metrics are absent (graceful degradation).
 * Renders a "Gathering data..." label when there's insufficient history.
 */
export function AgentHealthBadge({ metrics }: Props) {
  if (metrics === undefined || metrics === null) {
    return null
  }

  if (!metrics.hasEnoughData) {
    return (
      <span className="text-xs text-dracula-comment italic">Gathering data...</span>
    )
  }

  const dots: { label: string; color: string; tooltip: string }[] = [
    {
      label: 'C',
      color: metrics.completionRate !== null ? completionColor(metrics.completionRate) : 'bg-dracula-comment',
      tooltip: metrics.completionRate !== null
        ? `Completion: ${(metrics.completionRate * 100).toFixed(0)}%`
        : 'Completion: n/a',
    },
    {
      label: 'T',
      color: metrics.throughputTrend !== null ? trendColor(metrics.throughputTrend) : 'bg-dracula-comment',
      tooltip: metrics.throughputTrend !== null
        ? `Trend: ${metrics.throughputTrend > 0 ? '+' : ''}${metrics.throughputTrend.toFixed(2)} tasks/wk`
        : 'Trend: n/a',
    },
    {
      label: 'E',
      color: metrics.errorDensity !== null ? errorColor(metrics.errorDensity) : 'bg-dracula-comment',
      tooltip: metrics.errorDensity !== null
        ? `Errors: ${(metrics.errorDensity * 100).toFixed(0)}%`
        : 'Errors: n/a',
    },
    {
      label: 'I',
      color: metrics.idleSeconds !== null ? idleColor(metrics.idleSeconds) : 'bg-dracula-comment',
      tooltip: metrics.idleSeconds !== null
        ? `Idle: ${formatIdle(metrics.idleSeconds)}`
        : 'Idle: n/a',
    },
  ]

  const tooltipText = dots.map((d) => d.tooltip).join(' · ')

  return (
    <div
      className="flex items-center gap-1"
      title={tooltipText}
      aria-label={`Health: ${tooltipText}`}
    >
      {dots.map((dot) => (
        <span
          key={dot.label}
          className={`inline-block w-2 h-2 rounded-full ${dot.color}`}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
