import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { StreamProvider } from '@/components/StreamProvider'
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}>
        <StreamProvider initial={initialAgents}>
          <nav className="border-b border-gray-800 bg-gray-900 px-6 py-4">
            <a href="/" className="text-lg font-bold text-white">
              Agents Galore
            </a>
          </nav>
          <main className="mx-auto max-w-6xl px-6 py-8">
            {children}
          </main>
        </StreamProvider>
      </body>
    </html>
  )
}
