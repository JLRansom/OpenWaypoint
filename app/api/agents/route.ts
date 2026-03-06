import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Agent, AgentType } from '@/lib/types'
import { getAllAgents, addAgent } from '@/lib/store'
import { runAgent } from '@/lib/agent-runner'

export async function GET() {
  return NextResponse.json(getAllAgents())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, prompt } = body as { type: AgentType; prompt: string }

  if (!type || !prompt) {
    return NextResponse.json({ error: 'type and prompt are required' }, { status: 400 })
  }

  const validTypes: AgentType[] = ['researcher', 'coder', 'writer']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'invalid agent type' }, { status: 400 })
  }

  const agent: Agent = {
    id: randomUUID(),
    type,
    prompt,
    status: 'queued',
    events: [],
    createdAt: Date.now(),
  }

  addAgent(agent)

  // Fire and forget
  runAgent(agent).catch(console.error)

  return NextResponse.json(agent, { status: 201 })
}
