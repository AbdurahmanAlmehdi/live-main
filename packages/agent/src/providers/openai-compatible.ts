import { PROVIDERS, type ProviderId } from '@livemain/protocol';
import { ProviderError, type ChatMessage, type CompleteRequest, type ModelProvider, type ModelTurn } from './types.js';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface ChatCompletion {
  choices: { message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; prompt_tokens_details?: { cached_tokens?: number } };
}

/**
 * Chat Completions with function tools, the API OpenAI, OpenRouter, Gemini's OpenAI
 * compatibility endpoint and self-hosted servers (vLLM, Ollama, LiteLLM) all accept.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: ProviderId;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly maxRetries: number;

  constructor(opts: { provider: ProviderId; apiKey: string; baseUrl?: string; fetch?: FetchLike; maxRetries?: number }) {
    const baseUrl = opts.baseUrl ?? PROVIDERS[opts.provider].defaultBaseUrl;
    if (!baseUrl) throw new Error(`${opts.provider} needs a base URL`);
    this.id = opts.provider;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? ((i, init) => fetch(i, init));
    this.maxRetries = opts.maxRetries ?? 6;
  }

  async complete(req: CompleteRequest): Promise<ModelTurn> {
    const body = {
      model: req.model,
      // OpenAI's own API renamed the limit; compatible servers still take max_tokens.
      ...(this.id === 'openai' ? { max_completion_tokens: req.maxOutputTokens } : { max_tokens: req.maxOutputTokens }),
      messages: [{ role: 'system', content: req.system }, ...toOpenAI(req.messages)],
      tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
    };
    const res = (await this.request('POST', '/chat/completions', body)) as ChatCompletion;
    const choice = res.choices[0];
    if (!choice) throw new ProviderError(this.id, 502, 'no choices in response');
    const toolCalls = (choice.message.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, input: parseArgs(c.function.arguments) }));
    const cached = res.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    return {
      text: choice.message.content ?? '',
      toolCalls,
      stop: choice.finish_reason === 'length' ? 'max_tokens' : choice.finish_reason === 'content_filter' ? 'refusal' : toolCalls.length > 0 ? 'tool_use' : 'end',
      usage: { input: (res.usage?.prompt_tokens ?? 0) - cached, output: res.usage?.completion_tokens ?? 0, cacheRead: cached, cacheWrite: 0 },
    };
  }

  async listModels(): Promise<string[]> {
    const res = (await this.request('GET', '/models')) as { data?: { id: string }[] };
    return (res.data ?? []).map((m) => m.id).sort();
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(this.id === 'openrouter' ? { 'x-title': 'Live Main' } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) return res.json();
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= this.maxRetries) {
        const text = await res.text().catch(() => '');
        throw new ProviderError(this.id, res.status, `${this.id} ${res.status}: ${text.slice(0, 500)}`);
      }
      const after = Number(res.headers.get('retry-after'));
      await new Promise((r) => setTimeout(r, Number.isFinite(after) && after > 0 ? after * 1000 : Math.min(30_000, 500 * 2 ** attempt)));
    }
  }
}

function toOpenAI(messages: ChatMessage[]): unknown[] {
  return messages.flatMap((m): unknown[] => {
    switch (m.role) {
      case 'user':
        return [{ role: 'user', content: m.text }];
      case 'assistant':
        return [
          {
            role: 'assistant',
            content: m.text || null,
            ...(m.toolCalls.length > 0
              ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } })) }
              : {}),
          },
        ];
      case 'tool':
        return m.results.map((r) => ({ role: 'tool', tool_call_id: r.id, content: r.isError ? `error: ${r.content}` : r.content }));
    }
  });
}

function parseArgs(args: string): Record<string, unknown> {
  try {
    const v = JSON.parse(args || '{}') as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    // A malformed call becomes an empty input; the tool reports the missing argument back.
    return {};
  }
}
