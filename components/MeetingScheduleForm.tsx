'use client'

import { useState } from 'react'
import { X, Clock } from 'lucide-react'
import { validateCron, describeCron } from '@/lib/cron-utils'

const PRESETS = [
  { label: 'Daily 9am',      cron: '0 9 * * *'   },
  { label: 'Mon–Fri 9am',    cron: '0 9 * * 1-5' },
  { label: 'Weekly Mon 9am', cron: '0 9 * * 1'   },
  { label: 'Weekly Fri 5pm', cron: '0 17 * * 5'  },
]

export function MeetingScheduleForm({
  projectId,
  onCreated,
  onClose,
}: {
  projectId: string
  onCreated: () => void
  onClose: () => void
}) {
  const [cronExpression, setCronExpression] = useState('0 9 * * 1-5')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validationError = validateCron(cronExpression)
  const description = validationError ? null : describeCron(cronExpression)

  async function handleSubmit() {
    if (validationError || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/meeting-schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cronExpression }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to create schedule')
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dracula-darker border border-dracula-dark/50 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-dracula-purple" />
            <h2 className="text-sm font-semibold text-dracula-light">Schedule Meetings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-dracula-comment hover:text-dracula-light transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-2">Quick presets</p>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {PRESETS.map((p) => (
            <button
              key={p.cron}
              onClick={() => setCronExpression(p.cron)}
              className={`text-xs py-1.5 px-2 rounded-lg border transition-colors ${
                cronExpression === p.cron
                  ? 'border-dracula-purple bg-dracula-purple/20 text-dracula-purple'
                  : 'border-dracula-dark/50 text-dracula-comment hover:text-dracula-light hover:border-dracula-dark'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom cron */}
        <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-2">Custom cron expression</p>
        <input
          value={cronExpression}
          onChange={(e) => setCronExpression(e.target.value)}
          placeholder="0 9 * * 1-5"
          className="w-full bg-dracula-dark border border-dracula-dark/80 rounded-lg px-3 py-2 text-sm text-dracula-light font-mono placeholder:text-dracula-comment focus:outline-none focus:border-dracula-purple transition-colors mb-2"
        />

        {/* Preview / validation */}
        {validationError ? (
          <p className="text-[11px] text-dracula-red mb-3">{validationError}</p>
        ) : description ? (
          <p className="text-[11px] text-dracula-green mb-3">↻ {description}</p>
        ) : null}

        {error && <p className="text-[11px] text-dracula-red mb-3">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs text-dracula-comment hover:text-dracula-light border border-dracula-dark/50 hover:border-dracula-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!!validationError || submitting}
            className="flex-1 py-2 rounded-lg text-xs font-semibold bg-dracula-purple/20 text-dracula-purple hover:bg-dracula-purple/30 disabled:opacity-40 transition-colors"
          >
            {submitting ? 'Saving...' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
