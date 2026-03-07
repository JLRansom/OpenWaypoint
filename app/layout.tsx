import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { StreamProvider } from '@/components/StreamProvider'
import { Sidebar } from '@/components/Sidebar'
import { getAllAgents } from '@/lib/store'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Agents Galore',
  description: 'Spawn, monitor, and view AI agents in real time',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const initialAgents = getAllAgents()

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-dracula-darker text-dracula-light`}>
        <StreamProvider initial={initialAgents}>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto p-8">
              <div className="max-w-5xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </StreamProvider>
      </body>
    </html>
  )
}
