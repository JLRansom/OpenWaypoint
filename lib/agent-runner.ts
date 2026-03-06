import Anthropic from '@anthropic-ai/sdk'
import { Agent } from '@/lib/types'
import { updateAgent, appendEvent } from '@/lib/store'

const client = new Anthropic()

const SYSTEM_PROMPTS: Record<Agent['type'], string> = {
  researcher:
    'You are a research analyst. Analyze topics thoroughly, summarize key findings clearly, and cite your reasoning step by step. Be concise but comprehensive.',
  coder:
    'You are an expert software engineer. Write clean, well-structured code. Explain your design decisions. Handle edge cases. Prefer clarity over cleverness.',
  writer:
    'You are a professional writer. Draft clear, structured prose in first person. No fluff or filler. Short paragraphs. Bullet points where appropriate.',
}

export async function runAgent(agent: Agent): Promise<void> {
  updateAgent(agent.id, { status: 'running' })

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: SYSTEM_PROMPTS[agent.type],
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
