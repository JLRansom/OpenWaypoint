import { NextResponse } from 'next/server'
import { dbGetTaskRunsByTask } from '@/lib/db/repositories/taskRunRepo'

export function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return params.then(({ id }) => {
    const runs = dbGetTaskRunsByTask(id)
    return NextResponse.json(runs)
  })
}
