'use client'

import { useState } from 'react'
import { useStream } from '@/components/StreamProvider'
import { Trash2, Plus, Check, X } from 'lucide-react'
import type { ProjectTag } from '@/lib/types'

/** 12-color palette for quick tag color selection. */
const COLOR_PALETTE = [
  '#ff5555', // red
  '#ff79c6', // pink
  '#bd93f9', // purple
  '#6272a4', // comment (default)
  '#8be9fd', // cyan
  '#50fa7b', // green
  '#f1fa8c', // yellow
  '#ffb86c', // orange
  '#ff6e6e', // bright red
  '#a4c7ff', // light blue
  '#ffffff', // white
  '#44475a', // dark grey
]

interface EditState {
  name: string
  color: string
}

export function TagsPanel({ projectId }: { projectId: string }) {
  const stream = useStream()
  const tags = (stream.projectTags ?? []).filter((t) => t.projectId === projectId)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState>({ name: '', color: '' })
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLOR_PALETTE[3])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleAdd() {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      })
      setNewName('')
      setNewColor(COLOR_PALETTE[3])
      setAddingNew(false)
    } catch (err) {
      console.error('Failed to add tag:', err)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(tag: ProjectTag) {
    setEditingId(tag.id)
    setEditState({ name: tag.name, color: tag.color })
  }

  async function saveEdit(tag: ProjectTag) {
    if (!editState.name.trim() || saving) return
    setSaving(true)
    try {
      await fetch(`/api/projects/${projectId}/tags/${tag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editState.name.trim(), color: editState.color }),
      })
      setEditingId(null)
    } catch (err) {
      console.error('Failed to update tag:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tag: ProjectTag) {
    const tagCount = tags.length
    const confirmed = window.confirm(
      `Delete tag "${tag.name}"? ${tagCount > 0 ? 'It will be removed from all cards.' : ''}`
    )
    if (!confirmed) return
    setDeletingId(tag.id)
    try {
      await fetch(`/api/projects/${projectId}/tags/${tag.id}`, { method: 'DELETE' })
    } catch (err) {
      console.error('Failed to delete tag:', err)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-comment mb-0.5">Project Tags</p>
          <p className="text-xs text-dracula-comment/70">
            Define tags with custom colors that appear on board cards.
          </p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setNewName('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dracula-green/20 text-dracula-green text-xs font-semibold hover:bg-dracula-green/30 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add Tag
        </button>
      </div>

      {/* Add new tag form */}
      {addingNew && (
        <div className="rounded-lg border border-dracula-green/30 bg-dracula-dark/60 p-4 space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-dracula-green">New Tag</p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingNew(false) }}
              placeholder="Tag name…"
              autoFocus
              className="flex-1 bg-dracula-darker border border-dracula-dark/60 rounded px-2.5 py-1.5 text-sm text-dracula-light placeholder-dracula-comment/50 focus:outline-none focus:border-dracula-green/50"
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || saving}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-dracula-green/20 text-dracula-green text-xs font-semibold hover:bg-dracula-green/30 disabled:opacity-40 transition-colors"
            >
              <Check className="w-3 h-3" />
              Add
            </button>
            <button
              onClick={() => setAddingNew(false)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-dracula-dark text-dracula-comment text-xs hover:text-dracula-light transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Tag list */}
      {tags.length === 0 && !addingNew ? (
        <p className="text-xs text-dracula-comment/60 italic">No tags yet. Add one to get started.</p>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-3 rounded-lg border border-dracula-dark/50 bg-dracula-dark/40 px-3 py-2.5"
            >
              {editingId === tag.id ? (
                <>
                  <ColorPicker value={editState.color} onChange={(c) => setEditState((s) => ({ ...s, color: c }))} />
                  <input
                    type="text"
                    value={editState.name}
                    onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(tag); if (e.key === 'Escape') setEditingId(null) }}
                    autoFocus
                    className="flex-1 bg-dracula-darker border border-dracula-dark/60 rounded px-2 py-1 text-sm text-dracula-light focus:outline-none focus:border-dracula-purple/50"
                  />
                  <button
                    onClick={() => saveEdit(tag)}
                    disabled={!editState.name.trim() || saving}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-dracula-purple/20 text-dracula-purple text-xs hover:bg-dracula-purple/30 disabled:opacity-40 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-dracula-dark text-dracula-comment text-xs hover:text-dracula-light transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <>
                  {/* Color swatch */}
                  <span
                    className="w-4 h-4 rounded-full border border-white/10 flex-shrink-0"
                    style={{ background: tag.color }}
                  />
                  {/* Preview pill */}
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border"
                    style={{
                      background: tag.color + '33',
                      color: tag.color,
                      borderColor: tag.color + '55',
                    }}
                  >
                    {tag.name}
                  </span>
                  <button
                    onClick={() => startEdit(tag)}
                    className="ml-auto text-[10px] text-dracula-comment hover:text-dracula-light transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(tag)}
                    disabled={deletingId === tag.id}
                    className="flex items-center gap-1 text-xs text-dracula-red/60 hover:text-dracula-red transition-colors disabled:opacity-40"
                    aria-label="Delete tag"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Inline color picker — a 12-swatch grid. */
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-6 h-6 rounded-full border-2 border-white/20 flex-shrink-0 focus:outline-none"
        style={{ background: value }}
        aria-label="Pick color"
      />
      {open && (
        <div className="absolute z-50 top-8 left-0 bg-dracula-darker border border-dracula-dark/60 rounded-lg p-2 shadow-xl">
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => { onChange(color); setOpen(false) }}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === value ? 'border-white' : 'border-transparent'}`}
                style={{ background: color }}
                aria-label={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
