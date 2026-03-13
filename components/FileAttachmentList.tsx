'use client'

import { useState, useEffect, useCallback } from 'react'
import { TaskFile } from '@/lib/types'
import { formatFileSize } from '@/lib/format-utils'

interface FileAttachmentListProps {
  taskId: string
  /** compact = icon badges only (KanbanCard); full = thumbnails + filenames + previews (Modal). */
  variant?: 'compact' | 'full'
  /** Refresh counter — increment to trigger a re-fetch. */
  refreshKey?: number
  /**
   * Pre-loaded file count from the SSE stream (task.fileCount).
   * When provided in compact mode the component skips the HTTP fetch entirely
   * and renders the count badge directly — eliminating the per-card waterfall.
   */
  preloadedCount?: number
}

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function FileIcon({ mimeType, className = 'w-4 h-4' }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75 7.5 10.5l3 3 3.75-4.5 5.25 6.75H2.25z" />
        <rect x="2.25" y="3.75" width="19.5" height="16.5" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (mimeType === 'application/pdf') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    )
  }
  // Code / text fallback
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileAttachmentList({
  taskId,
  variant = 'full',
  refreshKey = 0,
  preloadedCount,
}: FileAttachmentListProps) {
  const [files, setFiles] = useState<TaskFile[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [textPreview, setTextPreview] = useState<Record<string, string>>({})

  // Compact mode with a pre-loaded count never needs to fetch files.
  const skipFetch = variant === 'compact' && preloadedCount !== undefined

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/files`)
      if (res.ok) setFiles(await res.json())
    } finally {
      setLoading(false)
    }
  }, [taskId])

  useEffect(() => {
    if (skipFetch) {
      setLoading(false)
      return
    }
    fetchFiles()
  }, [fetchFiles, refreshKey, skipFetch])

  async function deleteFile(file: TaskFile) {
    if (!window.confirm(`Remove "${file.filename}"?`)) return
    setDeletingId(file.id)
    try {
      await fetch(`/api/tasks/${taskId}/files/${file.id}`, { method: 'DELETE' })
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      if (expandedId === file.id) setExpandedId(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function loadTextPreview(file: TaskFile) {
    if (textPreview[file.id]) return // already loaded
    try {
      const res = await fetch(`/api/files/${file.id}/content`)
      const text = await res.text()
      // Show first ~100 lines / 8 KB — whichever is smaller
      const lines = text.split('\n').slice(0, 100).join('\n').slice(0, 8192)
      setTextPreview((prev) => ({ ...prev, [file.id]: lines }))
    } catch {
      setTextPreview((prev) => ({ ...prev, [file.id]: '(preview unavailable)' }))
    }
  }

  function toggleExpand(file: TaskFile) {
    if (expandedId === file.id) {
      setExpandedId(null)
    } else {
      setExpandedId(file.id)
      if (isTextFile(file)) loadTextPreview(file)
    }
  }

  if (loading) return null

  // ------------------------------------------------------------------ compact
  if (variant === 'compact') {
    // Use preloadedCount from SSE stream when available (avoids HTTP fetch).
    const count = preloadedCount ?? files.length
    if (count === 0) return null
    return (
      <div className="flex items-center gap-1 mt-1">
        <svg className="w-3 h-3 text-dracula-comment/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
        <span className="text-[10px] text-dracula-comment/60">
          {count} {count === 1 ? 'file' : 'files'}
        </span>
      </div>
    )
  }

  // --------------------------------------------------------------------- full
  if (files.length === 0) {
    return (
      <p className="text-xs text-dracula-comment/60 mt-1">No files attached yet.</p>
    )
  }

  return (
    <div className="space-y-1.5 mt-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="rounded-lg border border-dracula-dark/60 overflow-hidden"
        >
          {/* File header row */}
          <div className="flex items-center gap-2 px-3 py-2">
            {/* Image thumbnail or icon */}
            {file.mimeType.startsWith('image/') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${file.id}/content`}
                alt={file.filename}
                className="w-8 h-8 rounded object-cover shrink-0 border border-dracula-dark/60"
              />
            ) : (
              <div className="w-8 h-8 rounded flex items-center justify-center bg-dracula-dark shrink-0 text-dracula-comment">
                <FileIcon mimeType={file.mimeType} className="w-4 h-4" />
              </div>
            )}

            {/* Name + size */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-dracula-light truncate" title={file.filename}>
                {file.filename}
              </p>
              <p className="text-[10px] text-dracula-comment/60">
                {formatFileSize(file.sizeBytes)} · {friendlyMime(file.mimeType)}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Expand preview for text/code files */}
              {isTextFile(file) && (
                <button
                  onClick={() => toggleExpand(file)}
                  className="text-[10px] text-dracula-cyan hover:text-dracula-light transition-colors"
                  title={expandedId === file.id ? 'Collapse' : 'Preview'}
                >
                  {expandedId === file.id ? '▲' : '▼'}
                </button>
              )}
              {/* Open in new tab */}
              <a
                href={`/api/files/${file.id}/content`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-dracula-blue hover:text-dracula-light transition-colors"
                title="Open"
              >
                ↗
              </a>
              {/* Delete */}
              <button
                onClick={() => deleteFile(file)}
                disabled={deletingId === file.id}
                className="text-[10px] text-dracula-red/60 hover:text-dracula-red transition-colors disabled:opacity-40"
                title="Remove"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Inline text preview */}
          {expandedId === file.id && isTextFile(file) && (
            <div className="border-t border-dracula-dark/40 px-3 py-2 max-h-48 overflow-auto">
              <pre className="text-[10px] text-dracula-light/80 font-mono whitespace-pre-wrap leading-relaxed">
                {textPreview[file.id] ?? 'Loading…'}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isTextFile(file: TaskFile): boolean {
  return (
    file.mimeType.startsWith('text/') ||
    file.mimeType === 'application/json' ||
    file.mimeType === 'application/xml'
  )
}

function friendlyMime(mime: string): string {
  const MAP: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/gif': 'GIF',
    'image/webp': 'WebP',
    'image/svg+xml': 'SVG',
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
    'text/csv': 'CSV',
    'text/javascript': 'JavaScript',
    'text/typescript': 'TypeScript',
    'application/json': 'JSON',
    'text/html': 'HTML',
    'text/css': 'CSS',
    'application/xml': 'XML',
    'text/xml': 'XML',
  }
  return MAP[mime] ?? mime
}
