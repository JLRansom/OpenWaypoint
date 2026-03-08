import { NextRequest, NextResponse } from 'next/server'
import { getAgent, updateAgent } from '@/lib/store'
import { cancelAgent } from '@/lib/agent-runner'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = getAgent(id)
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }
  return NextResponse.json(agent)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = getAgent(id)
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }
  cancelAgent(id)
  updateAgent(id, { status: 'failed', error: 'Cancelled by user', completedAt: Date.now() })
  return NextResponse.json({ ok: true })
}
