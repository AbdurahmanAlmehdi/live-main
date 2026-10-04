import type { ProviderId } from '@livemain/protocol';
import { AnthropicProvider } from './anthropic.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import type { ModelProvider, Usage } from './types.js';

export * from './types.js';
export { AnthropicProvider } from './anthropic.js';
export { OpenAICompatibleProvider } from './openai-compatible.js';

export function createProvider(opts: { provider: ProviderId; apiKey: string; baseUrl?: string | null }): ModelProvider {
  if (opts.provider === 'anthropic') return new AnthropicProvider({ apiKey: opts.apiKey });
  return new OpenAICompatibleProvider({ provider: opts.provider, apiKey: opts.apiKey, baseUrl: opts.baseUrl ?? undefined });
}

/** USD per million tokens. */
export interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Known list prices (Anthropic's published rates; cache writes at the 5-minute 1.25x rate).
 * Other providers' prices vary by model and route, so their cost is reported as unknown
 * unless the account sets a price.
 */
const PRICES: Record<string, Price> = {
  'anthropic/claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'anthropic/claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'anthropic/claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'anthropic/claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
};

/** Price for a model id, also matching dated ids (claude-haiku-4-5-20251001). */
export function priceOf(provider: ProviderId, model: string, overrides: Record<string, Price> = {}): Price | null {
  const key = `${provider}/${model}`;
  const table = { ...PRICES, ...overrides };
  if (table[key]) return table[key];
  const prefix = Object.keys(table).find((k) => key.startsWith(`${k}-`));
  return prefix ? table[prefix]! : null;
}

export function costUsd(usage: Usage, price: Price): number {
  return (usage.input * price.input + usage.output * price.output + usage.cacheRead * price.cacheRead + usage.cacheWrite * price.cacheWrite) / 1e6;
}
