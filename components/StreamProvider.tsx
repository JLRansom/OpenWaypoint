'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { StreamPayload } from '@/lib/types'

const defaultPayload: StreamPayload = { agents: [], projects: [], tasks: [] }

const StreamContext = createContext<StreamPayload>(defaultPayload)

export function useStream() {
  return useContext(StreamContext)
}

export function StreamProvider({
  initial,
  children,
}: {
  initial: StreamPayload
  children: ReactNode
}) {
  const [payload, setPayload] = useState<StreamPayload>(initial)

  useEffect(() => {
    const es = new EventSource('/api/stream')

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as StreamPayload
        setPayload(data)
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
    <StreamContext.Provider value={payload}>{children}</StreamContext.Provider>
  )
}
