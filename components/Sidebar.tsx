'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Waypoints,
  Home,
  LayoutDashboard,
  FolderKanban,
  History,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

const navLinks = [
  { href: '/',          label: 'Welcome',   icon: Home },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects',  label: 'Projects',  icon: FolderKanban },
  { href: '/history',   label: 'History',   icon: History },
  { href: '/settings',  label: 'Settings',  icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-open')
    if (stored !== null) setOpen(stored === 'true')
  }, [])

  function toggle() {
    setOpen((v) => {
      localStorage.setItem('sidebar-open', String(!v))
      return !v
    })
  }

  return (
    <aside
      className={`${open ? 'w-56' : 'w-14'} shrink-0 bg-dracula-surface border-r border-dracula-dark flex flex-col min-h-screen transition-[width] duration-200 ease-in-out overflow-hidden`}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-dracula-dark px-3 py-4 ${open ? 'justify-between' : 'justify-center'}`}>
        {open ? (
          <>
            <div className="flex items-center gap-2">
              <Waypoints className="w-5 h-5 text-dracula-purple shrink-0" />
              <span className="text-sm font-bold text-dracula-light whitespace-nowrap">OpenWaypoint</span>
            </div>
            <button
              onClick={toggle}
              title="Collapse sidebar"
              className="text-dracula-blue/60 hover:text-dracula-light transition-colors rounded p-0.5"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            onClick={toggle}
            title="Expand sidebar"
            className="text-dracula-blue/60 hover:text-dracula-light transition-colors rounded p-0.5"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              title={!open ? label : undefined}
              className={`flex items-center rounded-md py-2 text-sm transition-colors
                ${open ? 'gap-3 px-3' : 'justify-center px-2'}
                ${active
                  ? open
                    ? 'bg-dracula-purple/15 text-dracula-purple font-medium border-l-2 border-dracula-purple'
                    : 'bg-dracula-purple/20 text-dracula-purple'
                  : 'text-dracula-blue hover:text-dracula-light hover:bg-dracula-dark/30'
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {open && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      {open && (
        <div className="px-4 py-3 border-t border-dracula-dark">
          <p className="text-xs text-dracula-blue">sonnet · opus</p>
          <a href="https://openwaypoint.ai" target="_blank" rel="noopener noreferrer" className="text-xs text-dracula-blue/50 hover:text-dracula-blue transition-colors mt-1 block">openwaypoint.ai</a>
        </div>
      )}
    </aside>
  )
}
