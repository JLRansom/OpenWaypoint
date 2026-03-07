import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAgent } from '@/lib/store'
import { AgentLog } from '@/components/AgentLog'

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const agent = getAgent(id)

  if (!agent) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-dracula-cyan hover:text-dracula-light">
          ← Dashboard
        </Link>
        <span className="text-dracula-dark">/</span>
        <span className="text-sm text-dracula-blue font-mono">{id.slice(0, 8)}</span>
      </div>
      <AgentLog agentId={id} />
    </div>
  )
}
