'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, LayoutDashboard, History } from 'lucide-react'

const navLinks = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history', label: 'History', icon: History },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 shrink-0 bg-dracula-surface border-r border-dracula-dark flex flex-col min-h-screen">
      <div className="px-6 py-5 border-b border-dracula-dark flex items-center gap-2">
        <Zap className="w-6 h-6 text-dracula-purple" />
        <span className="text-base font-bold text-dracula-light">Agents Galore</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-dracula-purple/15 text-dracula-purple font-medium border-l-2 border-dracula-purple'
                  : 'text-dracula-blue hover:text-dracula-light hover:bg-dracula-dark/30'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-dracula-dark">
        <p className="text-xs text-dracula-blue">claude-sonnet-4-6</p>
      </div>
    </aside>
  )
}
