'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const NAME_MAX = 60
const NAME_WARN = 50
const DESC_MAX = 200
const DESC_WARN = 180

export function NewProjectModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [directory, setDirectory] = useState('')
  const [browseError, setBrowseError] = useState('')
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
        body: JSON.stringify({ name, description, directory }),
      })
      setName('')
      setDescription('')
      setDirectory('')
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleBrowse() {
    if (!('showDirectoryPicker' in window)) {
      setBrowseError('Folder picker is not supported in this browser. Please type the path manually.')
      return
    }
    setBrowseError('')
    try {
      // @ts-expect-error File System Access API not in all TS lib versions
      const handle = await window.showDirectoryPicker()
      setDirectory(handle.name)
    } catch {
      // user cancelled
    }
  }

  function handleClose() {
    setName('')
    setDescription('')
    setDirectory('')
    setBrowseError('')
    setOpen(false)
  }

  return (
    <>
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        + New Project
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-dracula-darker/80">
          <div className="w-full max-w-md rounded-xl bg-dracula-surface border border-dracula-dark p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-dracula-light">New Project</h2>
              <button
                onClick={handleClose}
                className="text-dracula-blue hover:text-dracula-light transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-sm font-medium text-dracula-blue">
                  Project Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={NAME_MAX}
                  placeholder="My awesome project"
                  className="w-full rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light placeholder:text-dracula-blue/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple"
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${name.length >= NAME_WARN ? 'text-dracula-red' : 'text-dracula-comment'}`}>
                    {name.length}/{NAME_MAX}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-dracula-blue">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={DESC_MAX}
                  rows={3}
                  placeholder="What is this project about?"
                  className="w-full rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light placeholder:text-dracula-blue/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple resize-none"
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${description.length >= DESC_WARN ? 'text-dracula-red' : 'text-dracula-comment'}`}>
                    {description.length}/{DESC_MAX}
                  </span>
                </div>
              </div>

              {/* Directory */}
              <div>
                <label className="mb-1 block text-sm font-medium text-dracula-blue">
                  Working Directory <span className="font-normal text-dracula-comment">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={directory}
                    onChange={(e) => setDirectory(e.target.value)}
                    placeholder="E:\path\to\project"
                    className="flex-1 rounded-lg border border-dracula-dark bg-dracula-dark text-dracula-light placeholder:text-dracula-blue/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dracula-purple font-mono"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={handleBrowse}
                    title="Pick a folder"
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Browse
                  </Button>
                </div>
                {browseError ? (
                  <p className="mt-1 text-xs text-dracula-red">{browseError}</p>
                ) : (
                  <p className="mt-1 text-xs text-dracula-comment">
                    Agents will reference this path when planning and implementing tasks.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="secondary" size="md" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" disabled={loading || !name.trim()}>
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
