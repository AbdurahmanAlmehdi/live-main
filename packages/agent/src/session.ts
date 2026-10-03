import type { CoordinatorApi, WorkcellClient } from '@livemain/core';
import { WorkcellError } from '@livemain/core';
import type { AgentId, AgentState, Notice, RunEvent, StrategyName, Task, TestRunResult } from '@livemain/protocol';
import { globToRegExp } from './glob.js';

export interface ToolOutcome {
  text: string;
  isError: boolean;
  /** true once the task's change has landed on main */
  landed?: boolean;
  /** submit only: false when no merge was attempted (e.g. it just finished a rebase) */
  attempted?: boolean;
}

export interface LandOutcome {
  landed: boolean;
  message: string;
  /** the strategy changed the view (checkpoint/rebase), so prior green tests no longer count */
  invalidateTests?: boolean;
  /** false when this submit only completed a step (finishing a rebase) and tried no merge */
  attempted?: boolean;
  /** the agent state this outcome puts the agent in */
  state?: { state: AgentState; detail: string };
}

/** VCS strategy: the only thing that differs between Live Main and the baselines. */
export interface Strategy {
  readonly name: StrategyName;
  readonly workspaceKind: 'livefs' | 'clone';
  /** create the workspace and register with the coordinator */
  setup(s: AgentSession): Promise<void>;
  /** called before every tool; returns notes to prepend to the tool result */
  beforeTool(s: AgentSession, tool: string): Promise<string[]>;
  /** called after a green task test run */
  afterTests?(s: AgentSession): Promise<void>;
  /** land the change (promote / merge PR / push) */
  land(s: AgentSession, message: string): Promise<LandOutcome>;
  /** whether `submit` requires a green run of the task tests since the last edit */
  requiresGreenForSubmit(s: AgentSession): boolean;
  /** describes the strategy-specific workflow for the system prompt */
  describe(): string;
  extraTools?(): { name: string; description: string; input_schema: Record<string, unknown> }[];
  callExtra?(s: AgentSession, name: string, input: Record<string, unknown>): Promise<ToolOutcome>;
}

/** Serializable session state, so an agent can resume in a new Durable Object alarm. */
export interface SessionSnapshot {
  pin: number;
  viewEpoch: number;
  dirty: boolean;
  greenEpoch: number | null;
  greenFiles: string[];
  landed: boolean;
  state: Record<string, unknown>;
  stats: SessionStats;
  noticeCursor: number;
  pendingInterrupt: boolean;
  interruptUnanswered?: boolean;
}

export interface SessionOptions {
  agentId: AgentId;
  task: Task;
  strategy: Strategy;
  workcell: WorkcellClient;
  /** name of the workcell for the coordinator's overlay registry */
  workcellName: string;
  coordinator: CoordinatorApi;
  /** git remote URL of main as seen from inside the workcell */
  remote: string;
  /** live-main: checkpoint every N tool calls */
  checkpointEvery?: number;
  /**
   * live-main: publish the overlay as a git commit after green tests and checkpoints, so
   * each agent's work in progress is cloneable (a per-agent fork, or a ref on main's repo).
   */
  snapshot?: { remote: string; ref?: string };
  clock?: () => number;
  /** aborting stops the agent at its next tool call (AgentStoppedError) */
  signal?: AbortSignal;
}

/** Thrown from a tool call once the session's signal is aborted; agent loops let it propagate. */
export class AgentStoppedError extends Error {
  constructor() {
    super('agent stopped');
    this.name = 'AgentStoppedError';
  }
}

export interface SessionStats {
  toolCalls: number;
  testRuns: number;
  checkpoints: number;
  submits: number;
  staleRejections: number;
  impactRejections: number;
  rebases: number;
  conflicts: number;
  noticesSeen: number;
  interrupts: number;
  /** interrupts after which the task tests passed again without any edit */
  falseInterrupts: number;
}

/**
 * Executes agent tools against a workcell workspace and enforces the protocol
 * (checkpoint triggers, test-before-submit, notice delivery). Used by both the
 * LLM agent and the scripted agent, so every strategy sees identical rules.
 */
export class AgentSession {
  readonly agentId: AgentId;
  readonly task: Task;
  readonly strategy: Strategy;
  readonly workcell: WorkcellClient;
  readonly workcellName: string;
  readonly coordinator: CoordinatorApi;
  readonly remote: string;
  readonly checkpointEvery: number;
  readonly snapshotTarget: { remote: string; ref?: string } | null;
  readonly now: () => number;
  readonly signal: AbortSignal | null;

  /** workspace id inside the workcell */
  readonly workspaceId: string;
  /** live-main: current pinned version of main */
  pin = 0;
  /** monotonic counter bumped whenever the view of main changes (checkpoint/rebase) */
  viewEpoch = 0;
  /** files written since the last green test run */
  dirty = false;
  /** epoch at which the task tests last passed with no edits since, or null */
  greenEpoch: number | null = null;
  /** test files that ran green in the last green run */
  greenFiles: string[] = [];
  landed = false;
  /** strategy-private state */
  state: Record<string, unknown> = {};

  readonly stats: SessionStats = {
    toolCalls: 0,
    testRuns: 0,
    checkpoints: 0,
    submits: 0,
    staleRejections: 0,
    impactRejections: 0,
    rebases: 0,
    conflicts: 0,
    noticesSeen: 0,
    interrupts: 0,
    falseInterrupts: 0,
  };

  private noticeCursor = 0;
  private pendingInterrupt = false;
  /** an interrupt arrived and no file has been edited since */
  private interruptUnanswered = false;
  /** last state reported to the coordinator (agent.state events) */
  private reported: { state: AgentState; detail: string } | null = null;

  constructor(opts: SessionOptions) {
    this.agentId = opts.agentId;
    this.task = opts.task;
    this.strategy = opts.strategy;
    this.workcell = opts.workcell;
    this.workcellName = opts.workcellName;
    this.coordinator = opts.coordinator;
    this.remote = opts.remote;
    this.checkpointEvery = opts.checkpointEvery ?? 8;
    this.snapshotTarget = opts.snapshot ?? null;
    this.now = opts.clock ?? (() => Date.now());
    this.signal = opts.signal ?? null;
    this.workspaceId = opts.agentId;
  }

  async start(): Promise<void> {
    await this.strategy.setup(this);
    await this.setState('working', `started on ${this.task.title}`);
  }

  get currentState(): AgentState | null {
    return this.reported?.state ?? null;
  }

  /** Report what the agent is doing now (best effort: observability never blocks the agent). */
  async setState(state: AgentState, detail: string): Promise<void> {
    if (this.reported?.state === state && this.reported.detail === detail) return;
    this.reported = { state, detail };
    await this.emitQuietly({ type: 'agent.state', agentId: this.agentId, state, detail, at: this.now() });
  }

  private async emitQuietly(event: RunEvent): Promise<void> {
    try {
      await this.emit(event);
    } catch {
      // events are for observers; the protocol does not depend on them
    }
  }

  snapshot(): SessionSnapshot {
    return {
      pin: this.pin,
      viewEpoch: this.viewEpoch,
      dirty: this.dirty,
      greenEpoch: this.greenEpoch,
      greenFiles: [...this.greenFiles],
      landed: this.landed,
      state: structuredClone(this.state),
      stats: { ...this.stats },
      noticeCursor: this.noticeCursor,
      pendingInterrupt: this.pendingInterrupt,
      interruptUnanswered: this.interruptUnanswered,
    };
  }

  restore(snap: SessionSnapshot): void {
    this.pin = snap.pin;
    this.viewEpoch = snap.viewEpoch;
    this.dirty = snap.dirty;
    this.greenEpoch = snap.greenEpoch;
    this.greenFiles = [...snap.greenFiles];
    this.landed = snap.landed;
    this.state = structuredClone(snap.state);
    Object.assign(this.stats, snap.stats);
    this.noticeCursor = snap.noticeCursor;
    this.pendingInterrupt = snap.pendingInterrupt;
    this.interruptUnanswered = snap.interruptUnanswered ?? false;
  }

  async close(): Promise<void> {
    try {
      await this.workcell.deleteWorkspace(this.workspaceId);
    } catch {
      // workspace may already be gone
    }
  }

  async emit(event: RunEvent): Promise<void> {
    await this.coordinator.emit(event);
  }

  /** true when the task tests are green for the current view and nothing changed since. */
  get testsGreen(): boolean {
    return this.greenEpoch === this.viewEpoch && !this.dirty;
  }

  invalidateTests(): void {
    this.greenEpoch = null;
  }

  /** Mark that the view of main changed under the agent. */
  bumpView(): void {
    this.viewEpoch++;
  }

  get interruptPending(): boolean {
    return this.pendingInterrupt;
  }

  clearInterrupt(): void {
    this.pendingInterrupt = false;
  }

  /** Record an interrupt-severity notice (from fan-out or from a checkpoint). */
  async noteInterrupt(detail = 'a contract it read changed on main'): Promise<void> {
    this.pendingInterrupt = true;
    this.interruptUnanswered = true;
    this.stats.interrupts++;
    await this.setState('interrupted', detail);
  }

  /** Wait without blocking a stop: throws AgentStoppedError once the session is stopped. */
  async pause(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.signal?.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
    });
    if (this.signal?.aborted) throw new AgentStoppedError();
  }

  // ---------------------------------------------------------------- tools

  async call(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
    if (this.signal?.aborted) throw new AgentStoppedError();
    this.stats.toolCalls++;
    if (MUTATING_TOOLS.has(name)) {
      this.interruptUnanswered = false;
      if (this.currentState === 'interrupted' || this.currentState === 'guarded') await this.setState('working', 'adapting the change');
    }
    let notes: string[] = [];
    let result: ToolOutcome;
    try {
      notes = await this.strategy.beforeTool(this, name);
      const outcome = await this.dispatch(name, input);
      const notices = await this.drainNotices();
      const text = [...notes, outcome.text, ...notices].filter((t) => t.length > 0).join('\n\n');
      result = { ...outcome, text };
    } catch (err) {
      const message =
        err instanceof WorkcellError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err);
      result = { text: [...notes, `error: ${message}`].join('\n\n'), isError: true };
    }
    await this.emitQuietly({ type: 'agent.step', agentId: this.agentId, tool: name, summary: stepSummary(name, input, result), ok: !result.isError, at: this.now() });
    return result;
  }

  private async dispatch(name: string, input: Record<string, unknown>): Promise<ToolOutcome> {
    const ws = this.workspaceId;
    switch (name) {
      case 'read_file': {
        const r = await this.workcell.read(ws, str(input.path), num(input.offset), num(input.limit));
        return { text: numbered(r.content, num(input.offset) ?? 1, r.totalLines), isError: false };
      }
      case 'write_file':
        await this.workcell.write(ws, str(input.path), str(input.content));
        this.dirty = true;
        return { text: `wrote ${str(input.path)}`, isError: false };
      case 'edit_file': {
        const r = await this.workcell.edit(ws, str(input.path), str(input.old_string), str(input.new_string), input.replace_all === true);
        this.dirty = true;
        return { text: `edited ${str(input.path)} (${r.replacements} replacement${r.replacements === 1 ? '' : 's'})`, isError: false };
      }
      case 'delete_file':
        await this.workcell.remove(ws, str(input.path));
        this.dirty = true;
        return { text: `deleted ${str(input.path)}`, isError: false };
      case 'revert_file':
        await this.workcell.revert(ws, str(input.path));
        this.dirty = true;
        return { text: `reverted ${str(input.path)} to the version you started from`, isError: false };
      case 'list_dir': {
        const r = await this.workcell.list(ws, typeof input.path === 'string' ? input.path : '', input.recursive === true);
        return { text: r.entries.map((e) => (e.type === 'dir' ? `${e.path}/` : e.path)).join('\n') || '(empty)', isError: false };
      }
      case 'grep': {
        const r = await this.workcell.grep(ws, str(input.pattern), {
          path: typeof input.path === 'string' ? input.path : undefined,
          glob: typeof input.glob === 'string' ? input.glob : undefined,
          maxResults: 100,
        });
        const lines = r.matches.map((m) => `${m.path}:${m.line}: ${m.text}`);
        if (r.truncated) lines.push('(truncated)');
        return { text: lines.join('\n') || '(no matches)', isError: false };
      }
      case 'replace_in_files':
        return this.replaceInFiles(str(input.glob), str(input.pattern), str(input.replacement), typeof input.flags === 'string' ? input.flags : 'g');
      case 'run_tests':
        return this.runTests(Array.isArray(input.files) ? (input.files as string[]) : undefined);
      case 'submit':
        return this.submit(typeof input.message === 'string' ? input.message : this.task.title);
      default:
        if (this.strategy.callExtra) return this.strategy.callExtra(this, name, input);
        return { text: `unknown tool ${name}`, isError: true };
    }
  }

  /** Bulk regex replace (JavaScript syntax) across files matching a glob; one tool call. */
  async replaceInFiles(glob: string, pattern: string, replacement: string, flags: string): Promise<ToolOutcome> {
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
    } catch (err) {
      return { text: `invalid pattern: ${err instanceof Error ? err.message : String(err)}`, isError: true };
    }
    const match = globToRegExp(glob);
    // List from the deepest directory that precedes the first wildcard.
    const wild = glob.search(/[*?]/);
    const fixed = wild < 0 ? glob : glob.slice(0, wild);
    const dir = fixed.includes('/') ? fixed.slice(0, fixed.lastIndexOf('/')) : '';
    const listing = await this.workcell.list(this.workspaceId, dir, true).catch(() => ({ entries: [] as { path: string; type: 'file' | 'dir' }[] }));
    const files = listing.entries.filter((e) => e.type === 'file' && match.test(e.path)).map((e) => e.path);
    const changed: string[] = [];
    let replacements = 0;
    for (const f of files) {
      const { content } = await this.workcell.read(this.workspaceId, f);
      let n = 0;
      const next = content.replace(re, (...args) => {
        n++;
        // Expand $1..$9 / $& like String.prototype.replace with a string replacement.
        const groups = args.slice(1, -2) as (string | undefined)[];
        return replacement.replace(/\$(\d|&)/g, (_, g: string) => (g === '&' ? (args[0] as string) : (groups[Number(g) - 1] ?? '')));
      });
      if (next !== content) {
        await this.workcell.write(this.workspaceId, f, next);
        changed.push(f);
        replacements += n;
      }
    }
    if (changed.length > 0) this.dirty = true;
    return {
      text: changed.length === 0 ? `no matches in ${files.length} files matching ${glob}` : `${replacements} replacements in ${changed.length} files: ${changed.slice(0, 20).join(', ')}${changed.length > 20 ? ', …' : ''}`,
      isError: false,
    };
  }

  async runTests(files?: string[]): Promise<ToolOutcome> {
    const requested = files && files.length > 0 ? files : this.task.tests;
    await this.setState('testing', `running ${requested.length} test file${requested.length === 1 ? '' : 's'}`);
    const result = await this.workcell.test(this.workspaceId, requested);
    this.stats.testRuns++;
    const coversTask = this.task.tests.every((t) => requested.includes(t));
    await this.emitQuietly({ type: 'agent.tests', agentId: this.agentId, passed: result.passed, failed: result.failed, ok: result.ok, at: this.now() });
    await this.setState(
      result.ok ? (coversTask ? 'ready' : 'working') : 'working',
      result.ok ? (coversTask ? `${result.passed} tests passing` : `${result.passed} tests passing (not the task's own)`) : `${result.failed} failing, ${result.passed} passing`,
    );
    if (result.ok && coversTask) {
      if (this.interruptUnanswered) {
        // The interrupt needed no change: the tests still pass on the new contract.
        this.stats.falseInterrupts++;
        this.interruptUnanswered = false;
      }
      this.greenEpoch = this.viewEpoch;
      this.greenFiles = requested;
      this.dirty = false;
      await this.strategy.afterTests?.(this);
    }
    return { text: formatTests(result, coversTask, this.task.tests), isError: false };
  }

  async submit(message: string): Promise<ToolOutcome> {
    this.stats.submits++;
    if (this.landed) return { text: 'already landed', isError: false, landed: true };
    if (this.strategy.requiresGreenForSubmit(this) && !this.testsGreen) {
      return {
        text: `submit refused: run the task tests (${this.task.tests.join(', ')}) and get them green after your last change${
          this.greenEpoch !== null && this.greenEpoch !== this.viewEpoch ? ' (main moved since your last green run)' : ''
        }.`,
        isError: true,
      };
    }
    const outcome = await this.strategy.land(this, message);
    if (outcome.invalidateTests) this.invalidateTests();
    if (outcome.landed) this.landed = true;
    if (outcome.state) await this.setState(outcome.state.state, outcome.state.detail);
    return { text: outcome.message, isError: !outcome.landed, landed: outcome.landed, attempted: outcome.attempted ?? true };
  }

  /** Fetch notices pushed by the coordinator since the last call and render them for the agent. */
  async drainNotices(): Promise<string[]> {
    const notices = await this.coordinator.notices(this.agentId, this.noticeCursor);
    if (notices.length === 0) return [];
    this.noticeCursor = Math.max(this.noticeCursor, ...notices.map((n) => Number(n.id)));
    this.stats.noticesSeen += notices.length;
    // Fan-out interrupts only trigger an early checkpoint; the checkpoint's own
    // classification is what counts (see noteInterrupt), so nothing is double-counted.
    if (notices.some((n) => n.severity === 'interrupt')) this.pendingInterrupt = true;
    return [renderNotices(notices)];
  }

  /** Advance the notice cursor without rendering (used after a checkpoint already reported them). */
  async skipNotices(): Promise<void> {
    const notices = await this.coordinator.notices(this.agentId, this.noticeCursor);
    if (notices.length > 0) this.noticeCursor = Math.max(this.noticeCursor, ...notices.map((n) => Number(n.id)));
  }
}

/** One line for the agent's activity log: the tool, its target and the first line of the result. */
export function stepSummary(tool: string, input: Record<string, unknown>, result: ToolOutcome): string {
  const target = typeof input.path === 'string' ? input.path : typeof input.glob === 'string' ? input.glob : typeof input.pattern === 'string' ? input.pattern : '';
  const first = result.text.split('\n').find((l) => l.trim() && !l.startsWith('[livemain]')) ?? '';
  const text = tool === 'read_file' || tool === 'list_dir' ? target : [target, first].filter(Boolean).join(' · ');
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

const MUTATING_TOOLS = new Set(['write_file', 'edit_file', 'delete_file', 'revert_file', 'replace_in_files']);

export function renderNotices(notices: Pick<Notice, 'severity' | 'kind' | 'path' | 'reason' | 'diff' | 'mergeResult'>[]): string {
  const rank = { interrupt: 0, review: 1, ignore: 2 } as const;
  const sorted = [...notices].sort((a, b) => rank[a.severity] - rank[b.severity]);
  const lines = ['[livemain] main moved under you:'];
  for (const n of sorted) {
    lines.push(`- ${n.severity.toUpperCase()} ${n.kind} ${n.path}: ${n.reason}${n.mergeResult ? ` (merge: ${n.mergeResult})` : ''}`);
    if (n.diff && n.severity !== 'ignore') lines.push(indent(n.diff.slice(0, 1500)));
  }
  if (sorted.some((n) => n.severity === 'interrupt')) {
    lines.push('Re-check your work against these changes before continuing; your view will be advanced to the latest main.');
  }
  return lines.join('\n');
}

export function formatTests(r: TestRunResult, coversTask: boolean, taskTests: string[]): string {
  const head = `${r.ok ? 'PASS' : 'FAIL'}: ${r.passed} passed, ${r.failed} failed (${r.durationMs} ms)`;
  const fails = r.files
    .filter((f) => !f.ok)
    .flatMap((f) => [`✗ ${f.file}`, ...f.failures.slice(0, 8).map((x) => `    ${x.name}: ${x.message.split('\n').slice(0, 4).join(' ')}`)]);
  const note = coversTask ? '' : `\n(note: submit needs a green run that includes ${taskTests.join(', ')})`;
  const tail = !r.ok && fails.length === 0 ? `\n${r.output.slice(-2000)}` : '';
  return [head, ...fails].join('\n') + tail + note;
}

function numbered(content: string, start: number, total: number): string {
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const width = String(start + lines.length).length;
  const body = lines.map((l, i) => `${String(start + i).padStart(width, ' ')}\t${l}`).join('\n');
  return lines.length + start - 1 < total ? `${body}\n… (${total} lines total)` : body;
}

function indent(s: string): string {
  return s
    .split('\n')
    .map((l) => `    ${l}`)
    .join('\n');
}

function str(v: unknown): string {
  if (typeof v !== 'string') throw new Error('expected a string argument');
  return v;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
