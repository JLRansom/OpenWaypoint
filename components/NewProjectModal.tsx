'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function NewProjectModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      setName('')
      setDescription('')
      setOpen(false)
      router.refresh()
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
        + New Project
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dracula-darker/80">
          <div className="w-full max-w-md rounded-xl bg-dracula-surface border border-dracula-dark p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dracula-light">New Project</h2>
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
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My awesome project"
                  className="w-full rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light placeholder:text-dracula-blue px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-dracula-blue">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="What is this project about?"
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
                  disabled={loading || !name.trim()}
                  className="rounded-lg bg-dracula-purple px-4 py-2 text-sm font-medium text-dracula-darker hover:bg-dracula-purple/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
