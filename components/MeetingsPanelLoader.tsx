'use client'

import dynamic from 'next/dynamic'

const MeetingsPanel = dynamic(
  () => import('@/components/MeetingsPanel').then((m) => ({ default: m.MeetingsPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-48 text-dracula-comment text-sm">
        Loading meetings…
      </div>
    ),
  },
)

export function MeetingsPanelLoader({ projectId }: { projectId: string }) {
  return <MeetingsPanel projectId={projectId} />
}
