import { NextResponse } from 'next/server'
import { getAllAgents, subscribe, unsubscribe } from '@/lib/store'
import { Agent } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let listener: ((agents: Agent[]) => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(getAllAgents())}\n\n`)
      )

      listener = (agents: Agent[]) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(agents)}\n\n`)
          )
        } catch {
          // Client disconnected mid-write
        }
      }

      subscribe(listener)
    },
    cancel() {
      if (listener) {
        unsubscribe(listener)
        listener = null
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
