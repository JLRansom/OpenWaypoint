import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Agent, AgentType } from '@/lib/types'
import { getAllAgents, addAgent, getProject } from '@/lib/store'

export async function GET() {
  return NextResponse.json(getAllAgents())
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, projectId } = body as { type: AgentType; projectId: string }

  if (!type || !projectId) {
    return NextResponse.json({ error: 'type and projectId are required' }, { status: 400 })
  }

  const validTypes: AgentType[] = ['researcher', 'coder', 'writer', 'senior-coder']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: 'invalid agent type' }, { status: 400 })
  }

  if (!getProject(projectId)) {
    return NextResponse.json({ error: 'project not found' }, { status: 404 })
  }

  const agent: Agent = {
    id: randomUUID(),
    type,
    prompt: '',
    status: 'idle',
    projectId,
    events: [],
    createdAt: Date.now(),
  }

  addAgent(agent)

  return NextResponse.json(agent, { status: 201 })
}
