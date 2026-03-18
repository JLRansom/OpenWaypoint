'use client'

import dynamic from 'next/dynamic'

const MeetingsPanel = dynamic(
  () => import('@/components/MeetingsPanel').then((m) => ({ default: m.MeetingsPanel })),
  { ssr: false },
)

export function MeetingsPanelLoader({ projectId }: { projectId: string }) {
  return <MeetingsPanel projectId={projectId} />
}
