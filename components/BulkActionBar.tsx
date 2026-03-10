'use client'

import { useState } from 'react'
import { BOARD_COLUMNS } from '@/lib/constants'

interface Props {
  selectedIds: Set<string>
  boardType: string
  onArchive: () => void
  onMove: (status: string) => void
  onDelete: () => void
  onClear: () => void
}

export function BulkActionBar({ selectedIds, boardType, onArchive, onMove, onDelete, onClear }: Props) {
  const [moveOpen, setMoveOpen] = useState(false)
  const count = selectedIds.size
  const visible = count > 0
  const columns = BOARD_COLUMNS[boardType] ?? BOARD_COLUMNS['general']

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <div className="bg-dracula-dark border border-dracula-purple/30 rounded-full px-4 py-2 flex items-center gap-3 shadow-xl">
        {/* Count + clear */}
        <span className="text-dracula-comment text-sm whitespace-nowrap">
          {count} selected
        </span>
        <button
          onClick={onClear}
          className="text-dracula-comment hover:text-dracula-light transition-colors text-sm leading-none"
          title="Clear selection"
        >
          ×
        </button>

        <div className="w-px h-4 bg-dracula-dark/80" />

        {/* Archive */}
        <button
          onClick={onArchive}
          className="text-dracula-yellow hover:text-dracula-light text-sm font-medium transition-colors whitespace-nowrap"
        >
          Archive
        </button>

        {/* Move to */}
        <div className="relative">
          <button
            onClick={() => setMoveOpen((o) => !o)}
            className="text-dracula-cyan hover:text-dracula-light text-sm font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
          >
            Move to
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M5 7L1 3h8L5 7z" />
            </svg>
          </button>
          {moveOpen && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 min-w-[160px] rounded-lg border border-dracula-dark bg-dracula-darker shadow-xl py-1">
              {columns.map((col) => (
                <button
                  key={col.value}
                  onClick={() => { setMoveOpen(false); onMove(col.value) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-dracula-light hover:bg-dracula-dark/60 transition-colors"
                >
                  {col.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-4 bg-dracula-dark/80" />

        {/* Delete */}
        <button
          onClick={onDelete}
          className="text-dracula-red hover:text-dracula-light text-sm font-medium transition-colors whitespace-nowrap"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
