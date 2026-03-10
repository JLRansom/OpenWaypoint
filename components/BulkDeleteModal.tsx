'use client'

interface Props {
  count: number
  onConfirm: () => void
  onCancel: () => void
}

export function BulkDeleteModal({ count, onConfirm, onCancel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-dracula-darker/80"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-dracula-surface border border-dracula-dark p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dracula-light">Delete Cards</h2>
          <button onClick={onCancel} className="text-dracula-blue hover:text-dracula-light">
            ✕
          </button>
        </div>

        <p className="text-sm text-dracula-red mb-1">
          Delete {count} card{count !== 1 ? 's' : ''}? This cannot be undone.
        </p>
        <p className="text-xs text-dracula-comment mb-6">
          All file attachments for the selected cards will also be permanently removed.
        </p>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm text-dracula-blue hover:text-dracula-light transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-dracula-red/20 border border-dracula-red/40 px-4 py-2 text-sm font-medium text-dracula-red hover:bg-dracula-red/30 transition-colors"
          >
            Delete {count} card{count !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
