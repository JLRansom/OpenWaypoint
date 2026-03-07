'use client'

import { useState } from 'react'
import { AgentType } from '@/lib/types'

export function NewAgentModal() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AgentType>('researcher')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    setLoading(true)
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, prompt }),
      })
      setPrompt('')
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-dracula-purple px-4 py-2 text-sm font-medium text-dracula-darker hover:bg-dracula-purple/90 transition-colors"
      >
        + New Agent
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dracula-darker/80">
          <div className="w-full max-w-md rounded-xl bg-dracula-surface border border-dracula-dark p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dracula-light">Spawn New Agent</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-dracula-blue hover:text-dracula-light"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-dracula-blue">
                  Agent Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as AgentType)}
                  className="w-full rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple"
                >
                  <option value="researcher">Researcher</option>
                  <option value="coder">Coder</option>
                  <option value="writer">Writer</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dracula-blue">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  placeholder="What should this agent do?"
                  className="w-full rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light placeholder:text-dracula-blue px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-dracula-blue hover:text-dracula-light"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="rounded-lg bg-dracula-purple px-4 py-2 text-sm font-medium text-dracula-darker hover:bg-dracula-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Spawning...' : 'Spawn Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
