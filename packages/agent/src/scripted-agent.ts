import type { Solution, SolutionOp, TaskId } from '@livemain/protocol';
import type { AgentResult } from './llm-agent.js';
import type { AgentSession, ToolOutcome } from './session.js';

export interface ScriptedAgentOptions {
  solution: Solution;
  /** trap tasks: the naive solution is tried first, the reference one after an impact rejection */
  naive?: Solution;
  /** simulated model latency per tool call, ms (mimics an LLM turn) */
  thinkMs?: () => number;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Deterministic agent that replays a reference solution through the same tools and
 * protocol as the LLM agent. It reacts to the strategy like a careful engineer would:
 * resolves conflict markers, re-applies its edits on the new base, switches solution
 * variants when a change order lands, and fixes trap regressions when told about them.
 */
export async function runScriptedAgent(session: AgentSession, opts: ScriptedAgentOptions): Promise<AgentResult> {
  const think = opts.thinkMs ?? (() => 0);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = opts.maxAttempts ?? 25;
  let solution = opts.naive ?? opts.solution;
  let turns = 0;
  let lastFailure = '';

  const call = async (name: string, input: Record<string, unknown>): Promise<ToolOutcome> => {
    turns++;
    const ms = think();
    if (ms > 0) await sleep(ms);
    return session.call(name, input);
  };

  // Orient like an agent would: README, then the files the change touches.
  await call('read_file', { path: 'README.md' });
  let variant = pickVariant(solution, await landedChangeOrders(session));
  for (const path of opsPaths(variant.ops)) await call('read_file', { path }).catch(() => undefined);
  await applyOps(variant.ops, call);

  // Budget = merge attempts; a submit that only finishes a rebase is not one.
  for (let attempt = 0; attempt < maxAttempts; ) {
    const tests = await call('run_tests', {});
    if (!tests.text.startsWith('PASS')) {
      lastFailure = tests.text;
      // Conflicts or contract changes may have left the overlay inconsistent: re-derive and re-apply.
      variant = pickVariant(solution, await landedChangeOrders(session));
      await resolveConflictMarkers(session, variant.ops, call);
      await applyOps(variant.ops, call);
      const retry = await call('run_tests', {});
      if (!retry.text.startsWith('PASS')) {
        lastFailure = retry.text;
        attempt++;
        continue;
      }
    }
    const sub = await call('submit', { message: session.task.title });
    if (sub.landed) return done('landed', 'landed');
    if (sub.attempted !== false) attempt++;
    lastFailure = sub.text;
    if (/a reviewer rejected/.test(sub.text)) return done('gave-up', sub.text);
    if (/breaks tests of code already on main/.test(sub.text) && solution !== opts.solution) {
      // Trap caught: undo the naive change, then apply the behavior-preserving solution.
      for (const path of opsPaths(variant.ops)) await call('revert_file', { path });
      solution = opts.solution;
    }
    variant = pickVariant(solution, await landedChangeOrders(session));
    await resolveConflictMarkers(session, variant.ops, call);
    await applyOps(variant.ops, call);
  }
  return done('gave-up', `attempts exhausted; last: ${lastFailure.slice(0, 1500)}`);

  function done(outcome: AgentResult['outcome'], reason: string): AgentResult {
    return { outcome, turns, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, reason };
  }
}

/** Change orders that have landed on main, from the coordinator's version log. */
async function landedChangeOrders(session: AgentSession): Promise<Set<TaskId>> {
  const out = new Set<TaskId>();
  let after = 0;
  for (;;) {
    const page = await session.coordinator.versions(after, 500);
    for (const v of page) if (v.taskId?.startsWith('co-')) out.add(v.taskId);
    if (page.length < 500) break;
    after = page[page.length - 1]!.version;
  }
  return out;
}

export function pickVariant(solution: Solution, landed: Set<TaskId>): Solution['variants'][number] {
  const eligible = solution.variants.filter((v) => v.requires.every((r) => landed.has(r)));
  eligible.sort((a, b) => b.requires.length - a.requires.length);
  const v = eligible[0] ?? solution.variants[0];
  if (!v) throw new Error(`solution ${solution.taskId} has no variants`);
  return v;
}

function opsPaths(ops: SolutionOp[]): string[] {
  return [...new Set(ops.flatMap((o) => (o.op === 'codemod' ? [] : [o.path])))];
}

type Call = (name: string, input: Record<string, unknown>) => Promise<ToolOutcome>;

/** Apply ops idempotently (safe to re-run on a base that already contains some of them). */
export async function applyOps(ops: SolutionOp[], call: Call): Promise<void> {
  for (const op of ops) {
    switch (op.op) {
      case 'write':
        await call('write_file', { path: op.path, content: op.content });
        break;
      case 'delete':
        await call('delete_file', { path: op.path });
        break;
      case 'insertBefore': {
        const text = await readRaw(op.path, call);
        if (text === null || text.includes(op.text)) break;
        // An edit, not a write of `text`: if main moves between this read and the change
        // (a checkpoint), writing the stale copy back would silently drop what landed.
        const line = anchorLine(text, op.anchor);
        if (line !== null) await call('edit_file', { path: op.path, old_string: line, new_string: op.text + line });
        break;
      }
      case 'edit': {
        const text = await readRaw(op.path, call);
        // Already applied? When newString extends oldString (an appended export), oldString
        // stays present, so look for newString; otherwise (incl. deletions) oldString is gone.
        const applied = op.newString.includes(op.oldString) ? text?.includes(op.newString) : !text?.includes(op.oldString);
        if (text === null || applied) break;
        await call('edit_file', { path: op.path, old_string: op.oldString, new_string: op.newString });
        break;
      }
      case 'codemod':
        // One bulk tool call, like an engineer running a codemod/sed across the tree.
        await call('replace_in_files', { glob: op.glob, pattern: op.find, flags: op.flags ?? 'g', replacement: op.replace });
        break;
    }
  }
}

export function insertBefore(text: string, anchor: string, insert: string): string | null {
  const idx = text.indexOf(anchor);
  if (idx < 0) return null;
  const lineStart = text.lastIndexOf('\n', idx) + 1;
  return text.slice(0, lineStart) + insert + text.slice(lineStart);
}

/** The whole line containing the first occurrence of anchor (without its newline). */
export function anchorLine(text: string, anchor: string): string | null {
  const idx = text.indexOf(anchor);
  if (idx < 0) return null;
  const start = text.lastIndexOf('\n', idx) + 1;
  const end = text.indexOf('\n', idx);
  return text.slice(start, end < 0 ? text.length : end);
}

/**
 * Resolve conflict markers by keeping main's side ("theirs" in a checkpoint merge,
 * "upstream" in a rebase) and then re-applying our ops on top of it.
 */
async function resolveConflictMarkers(session: AgentSession, ops: SolutionOp[], call: Call): Promise<void> {
  for (const path of opsPaths(ops)) {
    const text = await readRaw(path, call);
    if (text === null || !/^<<<<<<< /m.test(text)) continue;
    const resolved = keepSide(text, session.strategy.workspaceKind === 'clone' ? 'first' : 'second');
    await call('write_file', { path, content: resolved });
  }
}

/**
 * Keep one side of each conflict hunk. In a rebase the first side (HEAD) is upstream main;
 * in a checkpoint merge (ours = overlay, theirs = main) main is the second side.
 */
export function keepSide(text: string, side: 'first' | 'second'): string {
  const out: string[] = [];
  let mode: 'normal' | 'first' | 'base' | 'second' = 'normal';
  for (const line of text.split('\n')) {
    if (line.startsWith('<<<<<<< ')) mode = 'first';
    else if (line.startsWith('||||||| ') && mode === 'first') mode = 'base';
    else if (line === '=======' && (mode === 'first' || mode === 'base')) mode = 'second';
    else if (line.startsWith('>>>>>>> ') && mode === 'second') mode = 'normal';
    else if (mode === 'normal' || mode === side) out.push(line);
  }
  return out.join('\n');
}

async function readRaw(path: string, call: Call): Promise<string | null> {
  const r = await call('read_file', { path });
  if (r.isError) return null;
  return unnumber(r.text);
}



/**
 * Recover file content from a read_file tool result: the consecutive "N\t" numbered
 * lines starting at 1. Notices may precede or follow them.
 */
export function unnumber(text: string): string {
  const body: string[] = [];
  let next = 1;
  for (const l of text.split('\n')) {
    const m = /^\s*(\d+)\t(.*)$/.exec(l);
    if (m && Number(m[1]) === next) {
      body.push(m[2] ?? '');
      next++;
    } else if (next > 1 && !m) {
      break;
    }
  }
  return `${body.join('\n')}\n`;
}
