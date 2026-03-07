import { HistoryList } from '@/components/HistoryList'

export default function HistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-dracula-light mb-6">Agent History</h1>
      <HistoryList />
    </div>
  )
}
