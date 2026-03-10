import { NextRequest, NextResponse } from 'next/server'
import { getAgent, updateAgent, getTask, updateTask, deleteAgent } from '@/lib/store'
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
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = getAgent(id)
  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  let action = 'delete'
  try {
    const body = await req.json()
    if (body?.action) action = body.action
  } catch {
    // no body or invalid JSON — default to delete
  }

  if (action === 'cancel') {
    cancelAgent(id)
    updateAgent(id, { status: 'failed', error: 'Cancelled by user', completedAt: Date.now() })
    return NextResponse.json({ ok: true })
  }

  // delete action
  if (agent.status === 'running' || agent.status === 'queued') {
    return NextResponse.json(
      { error: 'Cancel the agent before deleting' },
      { status: 409 }
    )
  }

  // Clear activeAgentId on associated task if needed
  if (agent.taskId) {
    const task = getTask(agent.taskId)
    if (task && task.activeAgentId === id) {
      updateTask(agent.taskId, { activeAgentId: undefined })
    }
  }

  deleteAgent(id)
  return NextResponse.json({ ok: true })
}
