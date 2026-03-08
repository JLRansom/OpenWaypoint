'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Check, X } from 'lucide-react'
import { TaskStatus } from '@/lib/types'
import { Button } from '@/components/ui/Button'

interface AddCardFormProps {
  projectId: string
  status: TaskStatus
  isActive: boolean
  onActivate: () => void
  onDeactivate: () => void
}

export function AddCardForm({ projectId, status, isActive, onActivate, onDeactivate }: AddCardFormProps) {
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isActive) inputRef.current?.focus()
  }, [isActive])

  function cancel() {
    setTitle('')
    onDeactivate()
  }

  async function handleSubmit() {
    if (!title.trim() || loading) return
    setLoading(true)
    try {
      await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), status }),
      })
      setTitle('')
      onDeactivate()
    } finally {
      setLoading(false)
    }
  }

  if (isActive) {
    return (
      <div className="rounded-lg border border-dracula-purple/40 bg-dracula-dark p-2">
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') cancel()
          }}
          placeholder="Card title..."
          className="w-full bg-transparent text-sm text-dracula-light placeholder:text-dracula-comment focus:outline-none"
        />
        <div className="flex items-center gap-1.5 mt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || loading}
            className="flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            {loading ? 'Adding…' : 'Add'}
          </Button>
          <Button variant="danger" size="sm" onClick={cancel} className="p-1 px-1">
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onActivate}
      className="flex items-center gap-1.5 w-full rounded-lg border border-dashed border-dracula-dark/50 px-2 py-1.5 text-xs text-dracula-comment hover:text-dracula-blue hover:border-dracula-dark transition-colors"
    >
      <Plus className="w-3 h-3" />
      Add Card
    </button>
  )
}
