'use client'

import { useState } from 'react'

interface Props {
  dangerouslySkipPermissions: boolean
}

export function SettingsClient({ dangerouslySkipPermissions: initial }: Props) {
  const [skipPerms, setSkipPerms] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggleSkipPerms(next: boolean) {
    setSaving(true)
    setSaved(false)
    setError(null)
    setSkipPerms(next)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dangerouslySkipPermissions', value: String(next) }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSkipPerms(!next) // revert
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Agent Execution section */}
      <section>
        <h2 className="text-base font-semibold text-dracula-light mb-1">Agent Execution</h2>
        <p className="text-sm text-dracula-blue mb-4">
          Controls how agents are spawned by the Claude CLI.
        </p>

        <div className="rounded-lg border border-dracula-dark bg-dracula-surface p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dracula-light">
                Bypass agent permission checks
              </p>
              <p className="text-xs text-dracula-blue mt-1 leading-relaxed">
                Passes <code className="font-mono bg-dracula-dark/60 px-1 py-0.5 rounded text-dracula-yellow">--dangerously-skip-permissions</code> to
                the Claude CLI. Agents will run without interactive permission prompts and can
                freely read, write, and execute files in the working directory.
                Only enable when you trust the agent&apos;s working directory and prompts.
              </p>
              {error && (
                <p className="text-xs text-dracula-red mt-2">{error}</p>
              )}
            </div>

            {/* Toggle */}
            <button
              role="switch"
              aria-checked={skipPerms}
              disabled={saving}
              onClick={() => toggleSkipPerms(!skipPerms)}
              className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-dracula-purple focus:ring-offset-2 focus:ring-offset-dracula-surface disabled:opacity-50 disabled:cursor-not-allowed
                ${skipPerms ? 'bg-dracula-orange' : 'bg-dracula-dark'}`}
              title={skipPerms ? 'Click to disable' : 'Click to enable'}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                  ${skipPerms ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {skipPerms && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-dracula-orange/10 border border-dracula-orange/30 px-3 py-2">
              <span className="text-dracula-orange text-sm">⚠</span>
              <p className="text-xs text-dracula-orange">
                Permission checks are disabled. Agents have unrestricted file system access.
              </p>
            </div>
          )}
        </div>

        {saved && (
          <p className="text-xs text-dracula-green mt-2">✓ Saved</p>
        )}
      </section>
    </div>
  )
}
