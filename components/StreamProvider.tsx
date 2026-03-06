'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { Agent } from '@/lib/types'

const StreamContext = createContext<Agent[]>([])

export function useStream() {
  return useContext(StreamContext)
}

export function StreamProvider({
  initial,
  children,
}: {
  initial: Agent[]
  children: ReactNode
}) {
  const [agents, setAgents] = useState<Agent[]>(initial)

  useEffect(() => {
    const es = new EventSource('/api/stream')

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Agent[]
        setAgents(data)
      } catch {
        // ignore malformed events
      }
    }

    es.onerror = () => {
      // EventSource will auto-reconnect
    }

    return () => {
      es.close()
    }
  }, [])

  return (
    <StreamContext.Provider value={agents}>{children}</StreamContext.Provider>
  )
}
