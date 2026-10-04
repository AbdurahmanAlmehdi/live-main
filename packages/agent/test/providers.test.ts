import { describe, expect, it } from 'vitest';
import { costUsd, OpenAICompatibleProvider, priceOf, ProviderError } from '../src/providers/index.js';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: (() => Response)[]) {
  const calls: Call[] = [];
  const fn = async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return next();
  };
  return { fn, calls };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => () =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('OpenAI-compatible provider', () => {
  it('sends the conversation as chat completions with function tools and maps the reply', async () => {
    const f = fakeFetch([
      json({
        choices: [{ finish_reason: 'tool_calls', message: { content: 'Reading.', tool_calls: [{ id: 'c1', function: { name: 'read_file', arguments: '{"path":"README.md"}' } }] } }],
        usage: { prompt_tokens: 120, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 100 } },
      }),
    ]);
    const p = new OpenAICompatibleProvider({ provider: 'openrouter', apiKey: 'sk-test', fetch: f.fn });
    const turn = await p.complete({
      model: 'some/model',
      system: 'be brief',
      maxOutputTokens: 256,
      tools: [{ name: 'read_file', description: 'read', inputSchema: { type: 'object' } }],
      messages: [
        { role: 'user', text: 'task' },
        { role: 'assistant', text: '', toolCalls: [{ id: 'c0', name: 'list_dir', input: {} }] },
        { role: 'tool', results: [{ id: 'c0', content: 'README.md', isError: false }] },
      ],
    });
    expect(f.calls[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = f.calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-test');
    const body = JSON.parse(String(f.calls[0]!.init.body)) as { max_tokens: number; messages: { role: string; tool_call_id?: string }[]; tools: { function: { name: string } }[] };
    expect(body.max_tokens).toBe(256);
    expect(body.messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'tool']);
    expect(body.messages[3]!.tool_call_id).toBe('c0');
    expect(body.tools[0]!.function.name).toBe('read_file');
    expect(turn).toMatchObject({ text: 'Reading.', stop: 'tool_use', toolCalls: [{ id: 'c1', name: 'read_file', input: { path: 'README.md' } }] });
    expect(turn.usage).toEqual({ input: 20, output: 30, cacheRead: 100, cacheWrite: 0 });
  });

  it('uses max_completion_tokens for OpenAI and retries 429s honoring retry-after', async () => {
    const f = fakeFetch([
      json({ error: 'slow down' }, 429, { 'retry-after': '0' }),
      json({ choices: [{ finish_reason: 'stop', message: { content: 'done' } }] }),
    ]);
    const p = new OpenAICompatibleProvider({ provider: 'openai', apiKey: 'k', fetch: f.fn });
    const turn = await p.complete({ model: 'm', system: '', maxOutputTokens: 64, tools: [], messages: [{ role: 'user', text: 'hi' }] });
    expect(f.calls).toHaveLength(2);
    expect(JSON.parse(String(f.calls[1]!.init.body))).toMatchObject({ max_completion_tokens: 64 });
    expect(turn.stop).toBe('end');
  });

  it('fails fast on auth errors with the provider status', async () => {
    const f = fakeFetch([json({ error: 'bad key' }, 401)]);
    const p = new OpenAICompatibleProvider({ provider: 'gemini', apiKey: 'k', fetch: f.fn });
    await expect(p.listModels()).rejects.toMatchObject({ status: 401, provider: 'gemini' });
    await expect(Promise.reject(new ProviderError('gemini', 401, 'x'))).rejects.toBeInstanceOf(ProviderError);
    expect(f.calls[0]!.url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/models');
  });

  it('needs a base URL for custom endpoints', () => {
    expect(() => new OpenAICompatibleProvider({ provider: 'openai-compatible', apiKey: 'k' })).toThrow(/base URL/);
  });
});

describe('pricing', () => {
  it('knows Anthropic list prices, including dated model ids, and nothing it cannot verify', () => {
    expect(priceOf('anthropic', 'claude-haiku-4-5-20251001')).toEqual({ input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 });
    expect(priceOf('openai', 'anything')).toBeNull();
    expect(priceOf('openai', 'x', { 'openai/x': { input: 2, output: 8, cacheRead: 0.5, cacheWrite: 0 } })?.input).toBe(2);
    expect(costUsd({ input: 1e6, output: 1e6, cacheRead: 1e6, cacheWrite: 1e6 }, priceOf('anthropic', 'claude-haiku-4-5')!)).toBeCloseTo(7.35);
  });
});
