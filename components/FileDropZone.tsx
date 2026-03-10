'use client'

import { useRef, useState, useCallback } from 'react'

interface UploadState {
  id: string
  filename: string
  status: 'uploading' | 'done' | 'error'
  error?: string
}

interface FileDropZoneProps {
  taskId: string
  /** Called after one or more files are successfully uploaded. */
  onUploaded: () => void
  /** Compact = card mode (minimal height); full = modal mode. */
  variant?: 'compact' | 'full'
  children?: React.ReactNode
}

/**
 * FileDropZone — wraps children with HTML5 drag-and-drop and provides a
 * "browse" button.  When files are dropped / selected it POSTs them to
 * `/api/tasks/[id]/files` as multipart/form-data.
 *
 * Design decisions:
 * - We check `e.dataTransfer.types.includes('Files')` so we only intercept
 *   genuine file drops, not @dnd-kit card-drag events.
 * - stopPropagation() is called only for real file drops; otherwise the
 *   dnd-kit draggable lifecycle is undisturbed.
 */
export function FileDropZone({ taskId, onUploaded, variant = 'full', children }: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploads, setUploads] = useState<UploadState[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const isFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes('Files')

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!isFileDrag(e)) return
    // Only clear when leaving the zone entirely (not a child element)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length) uploadFiles(files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskId]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length) uploadFiles(files)
      // Reset so same file can be re-selected
      e.target.value = ''
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [taskId]
  )

  async function uploadFiles(files: File[]) {
    // Add pending state entries — each gets a unique ID to avoid collision when
    // two files share the same name.
    const pending: UploadState[] = files.map((f) => ({
      id: crypto.randomUUID(),
      filename: f.name,
      status: 'uploading',
    }))
    setUploads((prev) => [...prev, ...pending])

    const formData = new FormData()
    for (const f of files) formData.append('file', f)

    try {
      const res = await fetch(`/api/tasks/${taskId}/files`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setUploads((prev) =>
          prev.map((u) =>
            pending.find((p) => p.id === u.id)
              ? { ...u, status: 'error', error: data.error ?? 'upload failed' }
              : u
          )
        )
        return
      }

      const savedNames = new Set((data.saved ?? []).map((s: { filename: string }) => s.filename))
      const errorMap = new Map(
        (data.errors ?? []).map((e: { filename: string; error: string }) => [e.filename, e.error])
      )

      setUploads((prev) =>
        prev.map((u) => {
          if (!pending.find((p) => p.id === u.id)) return u
          if (savedNames.has(u.filename)) return { ...u, status: 'done' }
          if (errorMap.has(u.filename)) return { ...u, status: 'error', error: errorMap.get(u.filename) as string }
          return u
        })
      )

      if (savedNames.size > 0) onUploaded()

      // Auto-clear after 3 s
      setTimeout(() => {
        setUploads((prev) =>
          prev.filter((u) => !pending.find((p) => p.id === u.id))
        )
      }, 3000)
    } catch {
      setUploads((prev) =>
        prev.map((u) =>
          pending.find((p) => p.id === u.id)
            ? { ...u, status: 'error', error: 'network error' }
            : u
        )
      )
    }
  }

  const borderClass = isDragOver
    ? 'border-dracula-purple/70 bg-dracula-purple/5'
    : 'border-dracula-dark/40 hover:border-dracula-purple/30'

  if (variant === 'compact') {
    // In compact (card) mode we just wrap the children — visual drop feedback
    // is shown as an overlay ring, not a standalone empty zone.
    return (
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-lg transition-all ${isDragOver ? 'ring-2 ring-dracula-purple/50' : ''}`}
      >
        {children}
        {isDragOver && (
          <div className="absolute inset-0 rounded-lg bg-dracula-purple/10 flex items-center justify-center pointer-events-none z-10">
            <span className="text-xs text-dracula-purple font-medium">Drop to attach</span>
          </div>
        )}
        {/* Upload progress toasts */}
        {uploads.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 space-y-0.5 p-1">
            {uploads.map((u) => (
              <UploadToast key={u.id} upload={u} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Full (modal) mode — shows a dedicated drop area below children
  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop target */}
      <div
        className={`mt-2 rounded-lg border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 py-4 px-3 ${borderClass}`}
      >
        <svg
          className={`w-6 h-6 transition-colors ${isDragOver ? 'text-dracula-purple' : 'text-dracula-comment/50'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-8m0 0-3 3m3-3 3 3M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
        </svg>
        <p className={`text-xs transition-colors ${isDragOver ? 'text-dracula-purple' : 'text-dracula-comment/70'}`}>
          {isDragOver ? 'Drop files here' : 'Drag & drop files, or'}
        </p>
        {!isDragOver && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-xs text-dracula-cyan hover:text-dracula-light transition-colors underline underline-offset-2"
          >
            browse to upload
          </button>
        )}
        <p className="text-[10px] text-dracula-comment/50">
          Images, PDF, text, code — up to 50 MB each
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="image/*,application/pdf,text/*,application/json,application/xml"
        onChange={handleInputChange}
      />

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="mt-2 space-y-1">
          {uploads.map((u) => (
            <UploadToast key={u.id} upload={u} />
          ))}
        </div>
      )}
    </div>
  )
}

function UploadToast({ upload }: { upload: UploadState }) {
  const color =
    upload.status === 'uploading'
      ? 'text-dracula-blue'
      : upload.status === 'done'
        ? 'text-dracula-green'
        : 'text-dracula-red'
  const icon =
    upload.status === 'uploading'
      ? '⏳'
      : upload.status === 'done'
        ? '✓'
        : '✗'

  return (
    <div className={`flex items-center gap-1.5 text-[10px] ${color} bg-dracula-darker/80 rounded px-2 py-0.5`}>
      <span>{icon}</span>
      <span className="truncate max-w-[140px]" title={upload.filename}>
        {upload.filename}
      </span>
      {upload.error && (
        <span className="text-dracula-red/80 truncate">{upload.error}</span>
      )}
    </div>
  )
}
