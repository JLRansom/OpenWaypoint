import Anthropic from '@anthropic-ai/sdk'
import { Agent, AgentType } from '@/lib/types'
import { updateAgent, appendEvent } from '@/lib/store'

const client = new Anthropic()

const MODEL_MAP: Record<AgentType, string> = {
  researcher: 'claude-opus-4-6',
  coder: 'claude-sonnet-4-6',
  writer: 'claude-sonnet-4-6',
  'senior-coder': 'claude-opus-4-6',
}

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  researcher:
    'You are a research analyst. Analyze topics thoroughly, summarize key findings clearly, and cite your reasoning step by step. Be concise but comprehensive.',
  coder:
    'You are an expert software engineer. Write clean, well-structured code. Explain your design decisions. Handle edge cases. Prefer clarity over cleverness.',
  writer:
    'You are a professional writer. Draft clear, structured prose in first person. No fluff or filler. Short paragraphs. Bullet points where appropriate.',
  'senior-coder':
    'You are a senior software engineer performing code review. Evaluate the implementation for correctness, edge cases, and code quality. End your review with exactly one of: "VERDICT: APPROVED" or "VERDICT: CHANGES REQUESTED". If requesting changes, include a "## Changes Required" section listing specific items to fix.',
}

export async function runAgent(agent: Agent): Promise<void> {
  updateAgent(agent.id, { status: 'running' })

  const systemPrompt = agent.systemPromptOverride ?? SYSTEM_PROMPTS[agent.type]
  const model = MODEL_MAP[agent.type]

  try {
    const stream = client.messages.stream({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: agent.prompt }],
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        appendEvent(agent.id, {
          timestamp: Date.now(),
          text: event.delta.text,
        })
      }
    }

    updateAgent(agent.id, { status: 'done', completedAt: Date.now() })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    updateAgent(agent.id, {
      status: 'failed',
      error: message,
      completedAt: Date.now(),
    })
  }
}
