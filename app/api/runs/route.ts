import { NextResponse } from 'next/server'
import { dbGetAllTaskRuns } from '@/lib/db/repositories/taskRunRepo'

export function GET() {
  const runs = dbGetAllTaskRuns()
  return NextResponse.json(runs)
}
