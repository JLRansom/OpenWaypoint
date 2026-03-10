import { spawn, execFile } from 'child_process'
import { platform } from 'os'
import type { Executor, ExecutorRunOptions } from './types'
import { MODEL_MAP, SYSTEM_PROMPTS } from './constants'

function which(bin: string): Promise<string | null> {
  const cmd = platform() === 'win32' ? 'where' : 'which'
  return new Promise((resolve) => {
    execFile(cmd, [bin], (err, stdout) => {
      resolve(err ? null : stdout.trim().split(/\r?\n/)[0])
    })
  })
}

export class LocalClaudeCliExecutor implements Executor {
  constructor(private readonly cliBin = 'claude') {}

  async run(options: ExecutorRunOptions): Promise<void> {
    const { agent, workingDirectory, onChunk, signal } = options

    const resolved = await which(this.cliBin)
    if (!resolved) {
      throw new Error(
        `Claude CLI not found: "${this.cliBin}". Install with: npm install -g @anthropic-ai/claude-code`
      )
    }

    const systemPrompt = agent.systemPromptOverride ?? SYSTEM_PROMPTS[agent.type]
    const model = MODEL_MAP[agent.type]

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--model', model,
      '--system-prompt', systemPrompt,
      '--dangerously-skip-permissions',
      agent.prompt,
    ]

    // Remove CLAUDECODE env var so the CLI doesn't refuse to run nested inside
    // another Claude Code session (the Next.js dev server may have it set).
    const env = { ...process.env }
    delete env.CLAUDECODE

    const child = spawn(this.cliBin, args, {
      cwd: workingDirectory,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const { onRawLine, onStats } = options

    const onAbort = () => {
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 2000)
    }
    signal.addEventListener('abort', onAbort, { once: true })

    return new Promise<void>((resolve, reject) => {
      let buf = ''
      let stderrBuf = ''
      let settled = false

      // Accumulate token counts across multi-turn conversations.
      // message_start carries input tokens; message_delta carries output tokens.
      let accumInputTokens = 0
      let accumOutputTokens = 0
      let accumTurns = 0

      const settle = (err?: Error) => {
        if (settled) return
        settled = true
        signal.removeEventListener('abort', onAbort)
        if (err) reject(err)
        else resolve()
      }

      child.stdout.on('data', (data: Buffer) => {
        buf += data.toString('utf8')
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          let parsed: Record<string, unknown>
          try { parsed = JSON.parse(trimmed) } catch { continue }
          onRawLine?.(trimmed)

          // ── Incremental text chunk ──────────────────────────────────────────
          if (parsed.type === 'stream_event') {
            const ev = parsed.event as Record<string, unknown> | undefined

            if (
              ev?.type === 'content_block_delta' &&
              (ev.delta as Record<string, unknown>)?.type === 'text_delta'
            ) {
              const text = (ev.delta as Record<string, unknown>).text as string
              onChunk({ text, timestamp: Date.now() })
            }

            // Live input-token count from the start of each API turn
            if (ev?.type === 'message_start' && onStats) {
              const msg = ev.message as Record<string, unknown> | undefined
              const usage = msg?.usage as Record<string, unknown> | undefined
              if (usage) {
                accumInputTokens += (usage.input_tokens as number | undefined) ?? 0
                accumTurns += 1
                onStats({
                  inputTokens: accumInputTokens,
                  outputTokens: accumOutputTokens,
                  totalTokens: accumInputTokens + accumOutputTokens,
                  numTurns: accumTurns,
                })
              }
            }

            // Live output-token count emitted at the end of each API turn
            if (ev?.type === 'message_delta' && onStats) {
              const usage = ev.usage as Record<string, unknown> | undefined
              if (usage) {
                accumOutputTokens += (usage.output_tokens as number | undefined) ?? 0
                onStats({
                  inputTokens: accumInputTokens,
                  outputTokens: accumOutputTokens,
                  totalTokens: accumInputTokens + accumOutputTokens,
                  numTurns: accumTurns,
                })
              }
            }
          }

          // ── Final result line ───────────────────────────────────────────────
          if (parsed.type === 'result') {
            if (parsed.is_error || parsed.subtype !== 'success') {
              // Emit whatever tokens were accumulated so failed runs still show
              // partial usage data in the UI rather than a blank stats row.
              if (onStats && (accumInputTokens > 0 || accumOutputTokens > 0)) {
                onStats({
                  inputTokens: accumInputTokens,
                  outputTokens: accumOutputTokens,
                  totalTokens: accumInputTokens + accumOutputTokens,
                  numTurns: Math.max(accumTurns, 1),
                })
              }
              settle(new Error(
                (parsed.error as string | undefined) ??
                `Claude CLI result: ${parsed.subtype}`
              ))
            } else if (onStats) {
              // The result line may carry authoritative totals — prefer them over
              // accumulated intermediates if present.
              const usage = parsed.usage as Record<string, unknown> | undefined
              const inputTokens =
                (usage?.input_tokens as number | undefined) ?? accumInputTokens
              const outputTokens =
                (usage?.output_tokens as number | undefined) ?? accumOutputTokens
              onStats({
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                numTurns: (parsed.num_turns as number | undefined) ?? Math.max(accumTurns, 1),
                // Cast directly — these fields are already `T | undefined`, so
                // appending `?? undefined` would be a no-op.
                costUsd: parsed.cost_usd as number | undefined,
                model: parsed.model as string | undefined,
              })
            }
          }
        }
      })

      child.stderr.on('data', (d: Buffer) => { stderrBuf += d.toString() })

      child.on('error', (err: NodeJS.ErrnoException) => {
        settle(err.code === 'ENOENT'
          ? new Error(`Claude CLI binary not found: "${this.cliBin}"`)
          : err
        )
      })

      child.on('close', (code) => {
        if (signal.aborted) {
          const e = new Error('Cancelled by user')
          e.name = 'AbortError'
          settle(e)
          return
        }
        if (code !== 0 && code !== null) {
          settle(new Error(`Claude CLI exited ${code}. stderr: ${stderrBuf.slice(0, 500)}`))
          return
        }
        settle()
      })
    })
  }
}
