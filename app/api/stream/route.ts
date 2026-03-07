import { NextResponse } from 'next/server'
import { getStreamPayload, subscribe, unsubscribe } from '@/lib/store'
import { StreamPayload } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let listener: ((payload: StreamPayload) => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(getStreamPayload())}\n\n`)
      )

      listener = (payload: StreamPayload) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
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
