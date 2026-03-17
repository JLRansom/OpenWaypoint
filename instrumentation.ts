/**
 * Next.js instrumentation hook — runs once when the server process starts,
 * on both the Node.js server runtime and (if present) the Edge runtime.
 *
 * This is the correct place for process-level singletons like the meeting
 * scheduler.  Running it here instead of as a store.ts module side-effect
 * means it no longer fires on every Server Component render or HMR reload
 * that happens to import store.ts.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // Only start the scheduler in the Node.js runtime (not Edge workers)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startMeetingScheduler } = await import('@/lib/meeting-scheduler')
    startMeetingScheduler()
  }
}
