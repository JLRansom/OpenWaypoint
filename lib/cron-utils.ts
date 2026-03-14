import { Cron } from 'croner'

/**
 * Compute the next run time for a cron expression after the given epoch-ms timestamp.
 * Returns epoch-ms or null if no future run exists (e.g. invalid expression).
 */
export function getNextCronRun(cronExpression: string, afterMs: number): number | null {
  try {
    const after = new Date(afterMs)
    const job = new Cron(cronExpression, { paused: true })
    const next = job.nextRun(after)
    return next ? next.getTime() : null
  } catch {
    return null
  }
}

/**
 * Get the next N upcoming run times for a cron expression.
 * Useful for calendar preview.
 */
export function getNextCronRuns(
  cronExpression: string,
  count: number,
  afterMs: number = Date.now(),
): number[] {
  const results: number[] = []
  try {
    const job = new Cron(cronExpression, { paused: true })
    let after = new Date(afterMs)
    for (let i = 0; i < count; i++) {
      const next = job.nextRun(after)
      if (!next) break
      results.push(next.getTime())
      after = new Date(next.getTime() + 1000) // advance past this run
    }
  } catch {
    // invalid cron — return empty array
  }
  return results
}

/**
 * Validate a cron expression. Returns an error string, or null if valid.
 */
export function validateCron(cronExpression: string): string | null {
  try {
    new Cron(cronExpression, { paused: true })
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Invalid cron expression'
  }
}

/**
 * Human-readable description of common cron patterns.
 * Falls back to the raw expression for unrecognised patterns.
 */
export function describeCron(cronExpression: string): string {
  const expr = cronExpression.trim()
  const known: Record<string, string> = {
    '0 9 * * *':   'Daily at 9:00 AM',
    '0 9 * * 1':   'Every Monday at 9:00 AM',
    '0 9 * * 1-5': 'Weekdays at 9:00 AM',
    '0 17 * * 5':  'Every Friday at 5:00 PM',
    '0 10 * * 1':  'Every Monday at 10:00 AM',
    '0 0 * * 1':   'Every Monday at midnight',
    '0 9 1 * *':   'First of every month at 9:00 AM',
  }
  if (known[expr]) return known[expr]

  // Basic parse attempt
  try {
    const parts = expr.split(/\s+/)
    if (parts.length !== 5) return expr
    const [min, hour, dom, , dow] = parts
    const h = parseInt(hour, 10)
    const m = parseInt(min, 10)
    if (isNaN(h) || isNaN(m)) return expr
    const timeStr = `${h}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    const normalizedHour = h > 12 ? h - 12 : h === 0 ? 12 : h

    if (dom !== '*') return `Monthly on day ${dom} at ${normalizedHour}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    if (dow === '1-5') return `Weekdays at ${normalizedHour}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    if (dow === '*') return `Daily at ${normalizedHour}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`

    const dayNames: Record<string, string> = { '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday', '4': 'Thursday', '5': 'Friday', '6': 'Saturday' }
    const dayName = dayNames[dow]
    if (dayName) return `Every ${dayName} at ${normalizedHour}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
    return `${timeStr} (${expr})`
  } catch {
    return expr
  }
}
