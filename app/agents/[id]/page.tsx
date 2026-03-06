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
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
          ← Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-mono">{id.slice(0, 8)}</span>
      </div>
      <AgentLog agentId={id} />
    </div>
  )
}
