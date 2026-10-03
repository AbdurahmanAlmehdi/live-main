import { AgentStoppedError, type AgentSession } from './session.js';
import { AGENT_TOOLS, agentBrief, taskMessage } from './tools.js';
import { AnthropicProvider, costUsd, priceOf, type ChatMessage, type ModelProvider, type ToolResult, type ToolSpec, type Usage } from './providers/index.js';

export const DEFAULT_WORKER_MODEL = 'claude-haiku-4-5';

export interface LlmAgentOptions {
  /** the model API (default: Anthropic with ANTHROPIC_API_KEY from the environment) */
  provider?: ModelProvider;
  model?: string;
  /** hard cap on model turns for one task */
  maxTurns?: number;
  /** hard cap on total input+output tokens for one task */
  maxTokens?: number;
  maxOutputTokens?: number;
  /** resume a paused run */
  resume?: LlmAgentState;
  /** epoch ms: pause (return state) once a turn finishes after this time */
  deadline?: number;
  /** what the codebase is, for the system prompt (e.g. the repo description) */
  project?: string;
}

/** Serializable loop state (messages + accounting) for resuming across Durable Object alarms. */
export interface LlmAgentState {
  messages: ChatMessage[];
  usage: Usage;
  turns: number;
}

export interface PausedAgent {
  outcome: 'paused';
  state: LlmAgentState;
}

export interface AgentResult {
  outcome: 'landed' | 'failed' | 'gave-up';
  turns: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reason: string;
}


/** Manual tool-use loop: the session decides checkpoints and injects notices into tool results. */
export async function runLlmAgent(session: AgentSession, opts: LlmAgentOptions & { deadline: number }): Promise<AgentResult | PausedAgent>;
export async function runLlmAgent(session: AgentSession, opts?: LlmAgentOptions): Promise<AgentResult>;
export async function runLlmAgent(session: AgentSession, opts: LlmAgentOptions = {}): Promise<AgentResult | PausedAgent> {
  const provider = opts.provider ?? new AnthropicProvider();
  const model = opts.model ?? DEFAULT_WORKER_MODEL;
  const price = priceOf(provider.id, model);
  const maxTurns = opts.maxTurns ?? 60;
  const maxTokens = opts.maxTokens ?? 1_500_000;
  const extra = (session.strategy.extraTools?.() ?? []).map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema }));
  const tools: ToolSpec[] = [...AGENT_TOOLS, ...extra];
  const system = agentBrief(session, opts.project ?? 'a shared codebase');
  const messages: ChatMessage[] = opts.resume?.messages ?? [{ role: 'user', text: taskMessage(session.task) }];
  const usage: Usage = opts.resume?.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let turns = opts.resume?.turns ?? 0;

  const result = (outcome: AgentResult['outcome'], reason: string): AgentResult => ({
    outcome,
    turns,
    inputTokens: usage.input,
    outputTokens: usage.output,
    cacheReadTokens: usage.cacheRead,
    cacheWriteTokens: usage.cacheWrite,
    reason,
  });

  while (turns < maxTurns) {
    if (session.signal?.aborted) throw new AgentStoppedError();
    if (opts.deadline !== undefined && Date.now() > opts.deadline) return { outcome: 'paused', state: { messages, usage, turns } };
    if (usage.input + usage.cacheRead + usage.cacheWrite + usage.output > maxTokens) return result('gave-up', 'token budget exhausted');
    turns++;
    const turn = await provider.complete({ model, system, tools, messages, maxOutputTokens: opts.maxOutputTokens ?? 8192 });
    usage.input += turn.usage.input;
    usage.output += turn.usage.output;
    usage.cacheRead += turn.usage.cacheRead;
    usage.cacheWrite += turn.usage.cacheWrite;
    await session
      .emit({
        type: 'agent.cost',
        agentId: session.agentId,
        usd: price ? costUsd(usage, price) : null,
        inputTokens: usage.input + usage.cacheRead + usage.cacheWrite,
        outputTokens: usage.output,
        at: Date.now(),
      })
      .catch(() => undefined);
    messages.push({ role: 'assistant', text: turn.text, toolCalls: turn.toolCalls, raw: turn.raw });

    if (turn.stop === 'refusal') return result('failed', 'model refused');
    if (turn.toolCalls.length === 0) {
      if (session.landed) return result('landed', 'landed');
      // The model stopped without landing: nudge it once per occurrence.
      messages.push({ role: 'user', text: 'Your change has not landed yet. Continue: get the task tests green and call submit.' });
      continue;
    }

    const results: ToolResult[] = [];
    // Tools run sequentially: they share one workspace and order matters (edit → test).
    for (const call of turn.toolCalls) {
      const outcome = await session.call(call.name, call.input);
      results.push({ id: call.id, content: outcome.text.slice(0, 30_000), isError: outcome.isError });
    }
    messages.push({ role: 'tool', results });
    if (session.landed) return result('landed', 'landed');
  }
  return result('gave-up', 'turn budget exhausted');
}
