/**
 * Shared formatting utilities used across the dashboard.
 * Centralises token/duration/elapsed helpers that were previously duplicated
 * across AgentProgressBar, TaskDetailModal, and other components.
 */

/**
 * Human-readable token count.
 *   1_234        → "1.2k"
 *   1_234_567    → "1.2M"
 *   999          → "999"
 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

/**
 * Duration between two epoch-ms timestamps.
 *   45_000  → "45s"
 *   90_000  → "1m 30s"
 */
export function formatDuration(startedAt: number, completedAt: number): string {
  const seconds = Math.round((completedAt - startedAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

/**
 * Elapsed time from a duration in milliseconds.
 *   45_000  → "45s"
 *   90_000  → "1m 30s"
 */
export function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}
