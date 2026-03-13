'use client'

import { useRouter } from 'next/navigation'

type View = 'board' | 'dashboard' | 'meetings'

export function ProjectViewToggle({
  projectId,
  currentView,
}: {
  projectId: string
  currentView: View
}) {
  const router = useRouter()

  function switchTo(view: View) {
    if (view === 'dashboard') {
      router.push(`/projects/${projectId}`)
    } else {
      router.push(`/projects/${projectId}?view=${view}`)
    }
  }

  return (
    <div className="flex gap-1 mb-6">
      <button
        onClick={() => switchTo('dashboard')}
        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
          currentView === 'dashboard'
            ? 'bg-dracula-purple/20 text-dracula-purple'
            : 'text-dracula-comment hover:text-dracula-foreground'
        }`}
      >
        Dashboard
      </button>
      <button
        onClick={() => switchTo('board')}
        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
          currentView === 'board'
            ? 'bg-dracula-cyan/20 text-dracula-cyan'
            : 'text-dracula-comment hover:text-dracula-foreground'
        }`}
      >
        Board
      </button>
      <button
        onClick={() => switchTo('meetings')}
        className={`text-xs font-semibold px-3 py-1 rounded-md transition-colors ${
          currentView === 'meetings'
            ? 'bg-dracula-pink/20 text-dracula-pink'
            : 'text-dracula-comment hover:text-dracula-foreground'
        }`}
      >
        Meetings
      </button>
    </div>
  )
}
