// lib/pricing.ts

export interface ModelPricing {
  inputPerMTok: number      // USD per 1M regular (non-cached) input tokens
  outputPerMTok: number     // USD per 1M output tokens
  cacheReadPerMTok: number  // USD per 1M cache-read input tokens (typically 0.1× input rate)
  cacheWritePerMTok: number // USD per 1M cache-write input tokens (typically 1.25× input rate)
}

/**
 * Pricing table keyed by model ID prefix.
 * Keys are matched against the model string from Claude CLI using startsWith,
 * so "claude-opus-4-6" matches "claude-opus-4-6-20260101" etc.
 * Order: most specific first (longer prefixes before shorter ones).
 *
 * Cache rates source: https://platform.claude.com/docs/en/about-claude/pricing
 * - Cache reads:  0.1× base input rate
 * - Cache writes: 1.25× base input rate
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // claude-opus-4 family
  'claude-opus-4-6':   { inputPerMTok: 5,    outputPerMTok: 25,   cacheReadPerMTok: 0.5,    cacheWritePerMTok: 6.25   },
  'claude-opus-4-5':   { inputPerMTok: 5,    outputPerMTok: 25,   cacheReadPerMTok: 0.5,    cacheWritePerMTok: 6.25   },
  'claude-opus-4-1':   { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.5,    cacheWritePerMTok: 18.75  },
  'claude-opus-4-0':   { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.5,    cacheWritePerMTok: 18.75  },
  'claude-opus-4':     { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.5,    cacheWritePerMTok: 18.75  },
  // claude-sonnet-4 family
  'claude-sonnet-4-6': { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.3,    cacheWritePerMTok: 3.75   },
  'claude-sonnet-4-5': { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.3,    cacheWritePerMTok: 3.75   },
  'claude-sonnet-4-0': { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.3,    cacheWritePerMTok: 3.75   },
  'claude-sonnet-4':   { inputPerMTok: 3,    outputPerMTok: 15,   cacheReadPerMTok: 0.3,    cacheWritePerMTok: 3.75   },
  // claude-haiku-4 family
  'claude-haiku-4-5':  { inputPerMTok: 1,    outputPerMTok: 5,    cacheReadPerMTok: 0.1,    cacheWritePerMTok: 1.25   },
  // claude-3.5 / claude-3 family
  'claude-3-5-haiku':  { inputPerMTok: 0.8,  outputPerMTok: 4,    cacheReadPerMTok: 0.08,   cacheWritePerMTok: 1.0    },
  'claude-haiku-3-5':  { inputPerMTok: 0.8,  outputPerMTok: 4,    cacheReadPerMTok: 0.08,   cacheWritePerMTok: 1.0    },
  'claude-3-opus':     { inputPerMTok: 15,   outputPerMTok: 75,   cacheReadPerMTok: 1.5,    cacheWritePerMTok: 18.75  },
  'claude-3-haiku':    { inputPerMTok: 0.25, outputPerMTok: 1.25, cacheReadPerMTok: 0.025,  cacheWritePerMTok: 0.3125 },
}

/**
 * Resolve pricing for a model string (e.g. "claude-opus-4-6-20260301").
 * Tries exact match first, then longest-prefix match so snapshot-dated model IDs
 * (e.g. "claude-opus-4-6-20260301") still resolve correctly.
 */
export function getModelPricing(model: string): ModelPricing | undefined {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]
  // Sort keys longest-first so more specific prefixes win over generic ones
  // (e.g. "claude-opus-4-6" wins over "claude-opus-4").
  const keys = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (model.startsWith(key)) return MODEL_PRICING[key]
  }
  return undefined
}

/**
 * Calculate cost in USD from token counts and model identifier.
 *
 * When cache token counts are provided, the correct per-tier rates are applied:
 *   - cacheReadTokens:  billed at cacheReadPerMTok  (~0.1× input rate)
 *   - cacheWriteTokens: billed at cacheWritePerMTok (~1.25× input rate)
 *   - remaining input:  billed at inputPerMTok
 *
 * Returns `undefined` if the model is unknown so callers can fall back to
 * CLI-reported cost or display a dash — this function never throws.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number | undefined {
  const pricing = getModelPricing(model)
  if (!pricing) return undefined
  // Regular input = total input minus the tokens already accounted for by cache
  const regularInput = Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
  return (
    (regularInput      / 1_000_000) * pricing.inputPerMTok +
    (cacheReadTokens   / 1_000_000) * pricing.cacheReadPerMTok +
    (cacheWriteTokens  / 1_000_000) * pricing.cacheWritePerMTok +
    (outputTokens      / 1_000_000) * pricing.outputPerMTok
  )
}
