import { AgentStatus } from '@/lib/types'

const styles: Record<AgentStatus, string> = {
  queued: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700 animate-pulse',
  done: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  )
}
