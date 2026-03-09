'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { AgentType } from '@/lib/types'
import { useStream } from '@/components/StreamProvider'
import { Button } from '@/components/ui/Button'

export function NewAgentModal() {
  const { projects } = useStream()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AgentType>('researcher')
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(false)

  function handleOpen() {
    setProjectId(projects[0]?.id ?? '')
    setOpen(true)
  }

  function handleClose() {
    setProjectId('')
    setOpen(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId) return
    setLoading(true)
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, projectId }),
      })
      handleClose()
    } finally {
      setLoading(false)
    }
  }

  const noProjects = projects.length === 0

  return (
    <>
      <Button variant="primary" size="md" onClick={handleOpen}>
        + New Agent
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dracula-darker/80">
          <div className="w-full max-w-md rounded-xl bg-dracula-surface border border-dracula-dark p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dracula-light">Spawn Agent</h2>
              <button onClick={handleClose} className="text-dracula-blue hover:text-dracula-light transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {noProjects ? (
              <div className="rounded-lg border border-dashed border-dracula-dark py-8 text-center">
                <p className="text-sm text-dracula-blue">No projects yet.</p>
                <p className="text-xs text-dracula-comment mt-1">Create a project first, then spawn agents for it.</p>
              </div>
            ) : (
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
                    <option value="senior-coder">Senior Coder</option>
                    <option value="tester">Tester</option>
                    <option value="writer">Writer</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-dracula-blue">
                    Assign to Project
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-dracula-comment">
                    This agent will only work on tasks from this project.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="secondary" size="md" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" disabled={loading || !projectId}>
                    {loading ? 'Spawning…' : 'Spawn Agent'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
