import type { ProviderId } from '@livemain/protocol';

/** Provider-neutral conversation, so one tool loop drives every model API. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
  isError: boolean;
}

export type ChatMessage =
  | { role: 'user'; text: string }
  /** `raw` is the provider's own assistant content, replayed verbatim to the same provider */
  | { role: 'assistant'; text: string; toolCalls: ToolCall[]; raw?: unknown }
  | { role: 'tool'; results: ToolResult[] };

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
  stop: 'tool_use' | 'end' | 'max_tokens' | 'refusal';
  usage: Usage;
  raw?: unknown;
}

export interface CompleteRequest {
  model: string;
  system: string;
  tools: ToolSpec[];
  messages: ChatMessage[];
  maxOutputTokens: number;
}

export interface ModelProvider {
  readonly id: ProviderId;
  complete(req: CompleteRequest): Promise<ModelTurn>;
  /** model ids this key can use (also serves as the key test) */
  listModels(): Promise<string[]>;
}

export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
