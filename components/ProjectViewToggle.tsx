'use client'

import { useRouter } from 'next/navigation'

type View = 'board' | 'analytics'

export function ProjectViewToggle({
  projectId,
  currentView,
}: {
  projectId: string
  currentView: View
}) {
  const router = useRouter()

  function switchTo(view: View) {
    router.push(`/projects/${projectId}?view=${view}`)
  }

  return (
    <div className="flex gap-1 mb-6">
      <button
        onClick={() => switchTo('board')}
        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
          currentView === 'board'
            ? 'bg-dracula-purple/20 text-dracula-purple'
            : 'text-dracula-comment hover:text-dracula-foreground'
        }`}
      >
        Board
      </button>
      <button
        onClick={() => switchTo('analytics')}
        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
          currentView === 'analytics'
            ? 'bg-dracula-cyan/20 text-dracula-cyan'
            : 'text-dracula-comment hover:text-dracula-foreground'
        }`}
      >
        Analytics
      </button>
    </div>
  )
}
