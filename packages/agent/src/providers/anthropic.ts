import Anthropic from '@anthropic-ai/sdk';
import type { ChatMessage, CompleteRequest, ModelProvider, ModelTurn, ToolCall } from './types.js';

/** Anthropic Messages API with automatic prompt caching (the breakpoint follows the conversation). */
export class AnthropicProvider implements ModelProvider {
  readonly id = 'anthropic' as const;
  private readonly client: Anthropic;

  constructor(opts: { apiKey?: string; client?: Anthropic } = {}) {
    this.client = opts.client ?? new Anthropic({ apiKey: opts.apiKey, maxRetries: 8 });
  }

  async complete(req: CompleteRequest): Promise<ModelTurn> {
    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxOutputTokens,
      cache_control: { type: 'ephemeral' },
      system: req.system,
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool.InputSchema })),
      messages: toAnthropic(req.messages),
    });
    const toolCalls: ToolCall[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      text,
      toolCalls,
      stop: response.stop_reason === 'refusal' ? 'refusal' : response.stop_reason === 'max_tokens' ? 'max_tokens' : toolCalls.length > 0 ? 'tool_use' : 'end',
      usage: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
        cacheRead: response.usage.cache_read_input_tokens ?? 0,
        cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
      },
      // Replayed verbatim so thinking blocks stay valid for the same model and conversation.
      raw: response.content,
    };
  }

  async listModels(): Promise<string[]> {
    const ids: string[] = [];
    for await (const m of this.client.models.list()) ids.push(m.id);
    return ids;
  }
}

function toAnthropic(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m): Anthropic.MessageParam => {
    switch (m.role) {
      case 'user':
        return { role: 'user', content: m.text };
      case 'assistant':
        return {
          role: 'assistant',
          content: (m.raw as Anthropic.ContentBlockParam[] | undefined) ?? [
            ...(m.text ? [{ type: 'text' as const, text: m.text }] : []),
            ...m.toolCalls.map((c) => ({ type: 'tool_use' as const, id: c.id, name: c.name, input: c.input })),
          ],
        };
      case 'tool':
        return {
          role: 'user',
          content: m.results.map((r) => ({ type: 'tool_result' as const, tool_use_id: r.id, content: r.content, is_error: r.isError })),
        };
    }
  });
}
