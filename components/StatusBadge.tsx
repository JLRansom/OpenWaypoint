import { AgentStatus } from '@/lib/types'

const styles: Record<AgentStatus, string> = {
  queued: 'bg-gray-700 text-gray-300',
  running: 'bg-blue-900 text-blue-300 animate-pulse',
  done: 'bg-green-900 text-green-300',
  failed: 'bg-red-900 text-red-300',
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
