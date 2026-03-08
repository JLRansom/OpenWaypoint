import { StreamPayload } from '@/lib/types'

type StoreListener = (payload: StreamPayload) => void

const g = globalThis as typeof globalThis & { __listeners?: Set<StoreListener> }
if (!g.__listeners) g.__listeners = new Set()

export function subscribe(listener: StoreListener): void {
  g.__listeners!.add(listener)
}

export function unsubscribe(listener: StoreListener): void {
  g.__listeners!.delete(listener)
}

export function broadcast(payload: StreamPayload): void {
  for (const listener of g.__listeners!) listener(payload)
}
