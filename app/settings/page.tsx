import { getSetting } from '@/lib/store'
import { SettingsClient } from '@/components/SettingsClient'

export default function SettingsPage() {
  const dangerouslySkipPermissions =
    getSetting('dangerouslySkipPermissions') === 'true'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-dracula-light">Settings</h1>
        <p className="text-sm text-dracula-blue mt-1">Configure app-wide behaviour</p>
      </div>

      <SettingsClient dangerouslySkipPermissions={dangerouslySkipPermissions} />
    </div>
  )
}
