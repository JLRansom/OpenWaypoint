import { AgentStatus } from '@/lib/types'

const styles: Record<AgentStatus, string> = {
  queued: 'bg-dracula-dark text-dracula-blue',
  running: 'bg-dracula-cyan/20 text-dracula-cyan animate-pulse',
  done: 'bg-dracula-green/20 text-dracula-green',
  failed: 'bg-dracula-red/20 text-dracula-red',
}

export function StatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  )
}
