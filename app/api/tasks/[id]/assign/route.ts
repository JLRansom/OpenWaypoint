import { NextRequest, NextResponse } from 'next/server'
import { assignAgentToTask, AssignRole } from '@/lib/services/agentService'

const VALID_ROLES: AssignRole[] = ['researcher', 'coder', 'senior-coder']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const { role } = body as { role: AssignRole }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'invalid role' }, { status: 400 })
  }

  const result = await assignAgentToTask(id, role)

  if (!('id' in result)) {
    const msg = result.error
    const status =
      msg === 'task not found' ? 404
      : msg.startsWith('No idle') ? 409
      : 400
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result, { status: 200 })
}
