import { AgentList } from '@/components/AgentList'
import { NewAgentModal } from '@/components/NewAgentModal'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Spawn and monitor your AI agents</p>
        </div>
        <NewAgentModal />
      </div>
      <AgentList />
    </div>
  )
}
