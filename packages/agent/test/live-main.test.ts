import type Anthropic from '@anthropic-ai/sdk';
import { Coordinator, LocalCoordinatorClient } from '@livemain/core';
import { nodeSqlStore } from '@livemain/core/node';
import type { Solution, Task } from '@livemain/protocol';
import { describe, expect, it } from 'vitest';
import { AgentSession, AgentStoppedError, AnthropicProvider, LiveMainStrategy, runLlmAgent, runScriptedAgent, type ModelProvider, type ModelTurn } from '../src/index.js';
import { FakeGit, FakeWorkcell, type Oracle } from './fake-world.js';

const MARKER = '  // functions (keep last)';
const REGISTRY = `export const registry = {\n${MARKER}\n};\n`;

/** value.ts may gain an ERRV variant (the change order); functions must then handle it. */
const oracle: Oracle = (view, testFile) => {
  const name = /tests\/(.+)\.test\.ts$/.exec(testFile)?.[1]!;
  const value = view('src/value.ts') ?? '';
  const src = view(`src/${name}.ts`);
  if (src === undefined) return `#NAME? src/${name}.ts missing`;
  if (!(view('src/registry.ts') ?? '').includes(`${name}:`)) return `#NAME? ${name} not registered`;
  if (src.includes('BROKEN')) return 'broken';
  if (value.includes('ERRV') && !src.includes('ERRV')) return `${name} does not handle the ERRV variant`;
  if (src.includes('uses:helper')) {
    const helper = view('src/helper.ts') ?? '';
    if (!helper.includes('emptyIsZero')) return `${name} relies on helper treating empty as zero`;
  }
  return null;
};

function world() {
  const git = new FakeGit({
    'README.md': '# formula engine\n',
    'src/value.ts': 'export type Value = number;\n',
    'src/helper.ts': 'export const helper = 1; // emptyIsZero\n',
    'src/registry.ts': REGISTRY,
  });
  const wc = new FakeWorkcell(git, oracle);
  const coord = new Coordinator({ sql: nodeSqlStore(), integrator: wc, remote: 'fake://main' });
  coord.init(git.head);
  return { git, wc, coord, client: new LocalCoordinatorClient(coord) };
}

const task = (id: string, kind: Task['kind'] = 'leaf'): Task => ({ id, kind, title: `do ${id}`, prompt: id, tests: [`tests/${id}.test.ts`], dependsOn: [] });

function fnSolution(name: string, withCo = false): Solution {
  const reg = { op: 'insertBefore' as const, path: 'src/registry.ts', anchor: MARKER, text: `  ${name}: () => import('./${name}'),\n` };
  return {
    taskId: name,
    variants: [
      { requires: [], ops: [{ op: 'write', path: `src/${name}.ts`, content: `export default 1;\n` }, reg] },
      ...(withCo ? [{ requires: ['co-ERRV'], ops: [{ op: 'write' as const, path: `src/${name}.ts`, content: `// handles ERRV\nexport default 2;\n` }, reg] }] : []),
    ],
  };
}

function session(w: ReturnType<typeof world>, agentId: string, t: Task) {
  return new AgentSession({ agentId, task: t, strategy: new LiveMainStrategy(), workcell: w.wc.asClient(), workcellName: 'wc', coordinator: w.client, remote: 'fake://main', checkpointEvery: 1000 });
}

describe('Live Main end to end (in-memory world)', () => {
  it('replays the worked example: C lands, A is told and adapts, B auto-merges the registry', async () => {
    const w = world();
    const A = session(w, 'A', task('SUM'));
    const B = session(w, 'B', task('DATE'));
    const C = session(w, 'C', { ...task('co-ERRV', 'change-order'), tests: [] });
    await Promise.all([A.start(), B.start(), C.start()]);

    // A and B implement their functions against v1.
    for (const [s, name] of [[A, 'SUM'], [B, 'DATE']] as const) {
      await s.call('write_file', { path: `src/${name}.ts`, content: 'export default 1;\n' });
      await s.call('edit_file', { path: 'src/registry.ts', old_string: MARKER, new_string: `  ${name}: () => import('./${name}'),\n${MARKER}` });
      expect((await s.call('run_tests', {})).text).toMatch(/^PASS/);
    }
    // C: the change order adds an error variant to the shared Value contract.
    await C.call('write_file', { path: 'src/value.ts', content: 'export type Value = number | ERRV;\n' });
    expect((await C.call('submit', { message: 'x' })).text).toMatch(/submit refused/); // tests not run since the edit
    expect((await C.call('run_tests', {})).text).toMatch(/^PASS/);
    const landedC = await C.call('submit', { message: 'add ERRV' });
    expect(landedC.landed).toBe(true);
    expect(w.coord.head().version).toBe(2);

    // A submits: main moved under a file it read (value.ts, signature) → stale, view advanced.
    const a1 = await A.call('submit', { message: 'SUM' });
    expect(a1.landed).toBeFalsy();
    expect(a1.text).toContain('NOT LANDED');
    expect(a1.text).toContain('src/value.ts');
    expect(a1.text).toMatch(/INTERRUPT/);
    expect(A.pin).toBe(2);
    // Its tests now fail on the new contract; it adapts and lands without any rebase.
    expect((await A.call('run_tests', {})).text).toContain('does not handle the ERRV variant');
    await A.call('write_file', { path: 'src/SUM.ts', content: '// handles ERRV\nexport default 2;\n' });
    expect((await A.call('run_tests', {})).text).toMatch(/^PASS/);
    expect((await A.call('submit', { message: 'SUM' })).landed).toBe(true);
    expect(w.coord.head().version).toBe(3);

    // B jumps v1 → v3: value.ts needs attention, registry.ts merges automatically.
    const b1 = await B.call('submit', { message: 'DATE' });
    expect(b1.landed).toBeFalsy();
    expect(b1.text).toMatch(/registry\.ts.*merge: merged/s);
    await B.call('write_file', { path: 'src/DATE.ts', content: '// handles ERRV\nexport default 3;\n' });
    expect((await B.call('run_tests', {})).text).toMatch(/^PASS/);
    expect((await B.call('submit', { message: 'DATE' })).landed).toBe(true);

    const main = w.git.tree(w.git.head);
    expect(w.coord.head().version).toBe(4);
    expect(main.get('src/registry.ts')).toContain('SUM:');
    expect(main.get('src/registry.ts')).toContain('DATE:');
    expect(main.get('src/value.ts')).toContain('ERRV');
    expect(w.coord.events().filter((e) => e.event.type === 'rebase')).toHaveLength(0);
  });

  it('scripted agents: concurrent leaves auto-merge the registry; a trap is caught by impact tests and fixed', async () => {
    const w = world();
    const leaves = ['ABS', 'MAX', 'MIN', 'LEN'];
    // F uses the helper and lands first; the trap's naive version breaks it.
    const F = session(w, 'F', task('F'));
    await F.start();
    const fSol: Solution = { taskId: 'F', variants: [{ requires: [], ops: [{ op: 'write', path: 'src/F.ts', content: '// uses:helper\nexport default 1;\n' }, { op: 'insertBefore', path: 'src/registry.ts', anchor: MARKER, text: "  F: () => import('./F'),\n" }] }] };
    expect((await runScriptedAgent(F, { solution: fSol })).outcome).toBe('landed');

    const trapTask = { ...task('T', 'trap'), breaks: ['F'] };
    const trapOps = (helper: string): Solution['variants'][number]['ops'] => [
      { op: 'write', path: 'src/helper.ts', content: helper },
      { op: 'write', path: 'src/T.ts', content: 'export default 1;\n' },
      { op: 'insertBefore', path: 'src/registry.ts', anchor: MARKER, text: "  T: () => import('./T'),\n" },
    ];
    const naive: Solution = { taskId: 'T', variants: [{ requires: [], ops: trapOps('export const helper = 2; // empty is an error now\n') }] };
    const reference: Solution = { taskId: 'T', variants: [{ requires: [], ops: trapOps('export const helper = 2; // emptyIsZero by default, opt-in strict mode\n') }] };

    const sessions = leaves.map((n, i) => session(w, `L${i}`, task(n)));
    const T = session(w, 'T', trapTask);
    await Promise.all([...sessions, T].map((s) => s.start()));
    const results = await Promise.all([
      ...sessions.map((s, i) => runScriptedAgent(s, { solution: fnSolution(leaves[i]!) })),
      runScriptedAgent(T, { solution: reference, naive }),
    ]);
    expect(results.map((r) => r.outcome)).toEqual(['landed', 'landed', 'landed', 'landed', 'landed']);
    expect(T.stats.impactRejections).toBe(1);
    const main = w.git.tree(w.git.head);
    for (const n of [...leaves, 'F', 'T']) expect(main.get('src/registry.ts')).toContain(`${n}:`);
    expect(main.get('src/helper.ts')).toContain('emptyIsZero');
    const rejected = w.coord.events().filter((e) => e.event.type === 'promotion.rejected').map((e) => (e.event as { reason: string }).reason);
    expect(rejected).toContain('impact-failed');
  });

  it('any provider drives the loop; it reports state, steps and cost, and stops on abort', async () => {
    const w = world();
    const abort = new AbortController();
    const s = new AgentSession({ agentId: 'oa-1', task: task('SUM'), strategy: new LiveMainStrategy(), workcell: w.wc.asClient(), workcellName: 'wc', coordinator: w.client, remote: 'fake://main', checkpointEvery: 1000, signal: abort.signal });
    await s.start();
    const turns: ModelTurn[] = [
      { text: '', stop: 'tool_use', usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 }, toolCalls: [{ id: '1', name: 'write_file', input: { path: 'src/SUM.ts', content: 'export default 1;\n' } }] },
      { text: '', stop: 'tool_use', usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 }, toolCalls: [{ id: '2', name: 'edit_file', input: { path: 'src/registry.ts', old_string: MARKER, new_string: `  SUM: () => import('./SUM'),\n${MARKER}` } }] },
      { text: '', stop: 'tool_use', usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 }, toolCalls: [{ id: '3', name: 'run_tests', input: {} }] },
      { text: '', stop: 'tool_use', usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 }, toolCalls: [{ id: '4', name: 'submit', input: { message: 'SUM' } }] },
    ];
    const provider: ModelProvider = { id: 'openai', complete: async () => turns.shift()!, listModels: async () => [] };
    const result = await runLlmAgent(s, { provider, model: 'gpt-x' });
    expect(result.outcome).toBe('landed');
    const events = w.coord.events().map((e) => e.event);
    const states = events.filter((e) => e.type === 'agent.state').map((e) => (e as { state: string }).state);
    expect(states).toEqual(['working', 'testing', 'ready', 'landed']);
    expect(events.filter((e) => e.type === 'agent.step').map((e) => (e as { tool: string }).tool)).toEqual(['write_file', 'edit_file', 'run_tests', 'submit']);
    const cost = events.filter((e) => e.type === 'agent.cost').at(-1) as { usd: number | null; outputTokens: number };
    expect(cost).toMatchObject({ usd: null, outputTokens: 20 });

    const s2 = new AgentSession({ agentId: 'oa-2', task: task('AVG'), strategy: new LiveMainStrategy(), workcell: w.wc.asClient(), workcellName: 'wc', coordinator: w.client, remote: 'fake://main', signal: abort.signal });
    await s2.start();
    abort.abort();
    await expect(runLlmAgent(s2, { provider, model: 'gpt-x' })).rejects.toBeInstanceOf(AgentStoppedError);
  });

  it('LLM agent loop drives the same tools (mocked Claude) and stops when landed', async () => {
    const w = world();
    const s = session(w, 'llm-1', task('SUM'));
    await s.start();
    const script: Anthropic.ContentBlock[][] = [
      [{ type: 'tool_use', id: 't1', name: 'read_file', input: { path: 'README.md' } } as Anthropic.ToolUseBlock],
      [
        { type: 'text', text: 'Implementing.', citations: null } as Anthropic.TextBlock,
        { type: 'tool_use', id: 't2', name: 'write_file', input: { path: 'src/SUM.ts', content: 'export default 1;\n' } } as Anthropic.ToolUseBlock,
        { type: 'tool_use', id: 't3', name: 'edit_file', input: { path: 'src/registry.ts', old_string: MARKER, new_string: `  SUM: () => import('./SUM'),\n${MARKER}` } } as Anthropic.ToolUseBlock,
      ],
      [{ type: 'tool_use', id: 't4', name: 'submit', input: { message: 'early' } } as Anthropic.ToolUseBlock],
      [{ type: 'tool_use', id: 't5', name: 'run_tests', input: {} } as Anthropic.ToolUseBlock],
      [{ type: 'tool_use', id: 't6', name: 'submit', input: { message: 'SUM' } } as Anthropic.ToolUseBlock],
    ];
    const seen: Anthropic.MessageCreateParams[] = [];
    let turn = 0;
    const client = {
      messages: {
        create: async (params: Anthropic.MessageCreateParams) => {
          seen.push(structuredClone(params));
          const content = script[turn++] ?? [{ type: 'text', text: 'done', citations: null }];
          return {
            content,
            stop_reason: content.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
            usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50, cache_creation_input_tokens: 10 },
          };
        },
      },
    } as unknown as Anthropic;
    const result = await runLlmAgent(s, { provider: new AnthropicProvider({ client }), model: 'claude-haiku-4-5' });
    expect(result.outcome).toBe('landed');
    expect(result.turns).toBe(5);
    expect(result.inputTokens).toBe(500);
    expect(result.cacheReadTokens).toBe(250);
    // The premature submit was refused with a tool error the model could see.
    const afterEarlySubmit = seen[3]!.messages.at(-1)!;
    expect(JSON.stringify(afterEarlySubmit)).toContain('submit refused');
    expect(seen[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(seen[0]!.tools!.map((t) => ('name' in t ? t.name : ''))).toContain('checkpoint');
    expect(w.coord.head().version).toBe(2);
  });
});

describe('replace_in_files', () => {
  it('applies a JS regex (lookarounds, groups) across a glob in one tool call', async () => {
    const w = world();
    const s = session(w, 'cm', task('cm'));
    await s.start();
    await s.call('write_file', { path: 'src/functions/a.ts', content: 'flattenArgs(args);\nfunction flattenArgs(x) {}\n' });
    await s.call('write_file', { path: 'src/functions/sub/b.ts', content: 'const v = flattenArgs(rest);\n' });
    await s.call('write_file', { path: 'src/other.ts', content: 'flattenArgs(args);\n' });
    const calls = s.stats.toolCalls;
    const out = await s.call('replace_in_files', {
      glob: 'src/functions/**/*.ts',
      pattern: '(?<!function )\\bflattenArgs\\((\\w+)\\)',
      replacement: "flattenArgs($1, { blanks: 'keep' })",
    });
    expect(s.stats.toolCalls).toBe(calls + 1);
    expect(out.text).toMatch(/2 replacements in 2 files/);
    expect((await w.wc.read('cm', 'src/functions/a.ts')).content).toBe("flattenArgs(args, { blanks: 'keep' });\nfunction flattenArgs(x) {}\n");
    expect((await w.wc.read('cm', 'src/functions/sub/b.ts')).content).toBe("const v = flattenArgs(rest, { blanks: 'keep' });\n");
    expect((await w.wc.read('cm', 'src/other.ts')).content).toBe('flattenArgs(args);\n'); // outside the glob
  });
});
