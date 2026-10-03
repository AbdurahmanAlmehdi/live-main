import type { Notice, OverlayState, RunEvent, StrategyName, Task, TaskId, Version } from '@livemain/protocol';
import { computeMetrics, type RunMetrics } from '@livemain/swarm';
import { agentLabel, strategyFromRunId, taskLabel } from './format.js';
import type { CellState, SeqEvent } from './types.js';

type Ev<T extends RunEvent['type']> = Extract<RunEvent, { type: T }>;

export interface Landing {
  version: Version;
  agentId: string;
  taskId: TaskId | null;
  paths: string[];
  merged: number;
  changeOrder: boolean;
  at: number;
}

export type FeedTone = 'interrupt' | 'review' | 'ignore' | 'caught' | 'reject' | 'rebase' | 'release' | 'regress' | 'green';

export interface FeedItem {
  id: number;
  at: number;
  tone: FeedTone;
  agentId: string | null;
  title: string;
  detail: string;
}

export interface AgentView {
  agentId: string;
  taskId: TaskId;
  startedAt: number;
  pin: Version | null;
  readSet: number | null;
  writeSet: number | null;
  notices: Notice[];
  rejections: number;
  rebases: number;
}

export interface CiSnapshot {
  version: Version;
  passed: number;
  failed: number;
  failing: Set<string>;
  at: number;
}

const FEED_CAP = 120;
const LANDINGS_CAP = 400;

/**
 * Folds a run's event stream into everything the views need. Events are applied incrementally;
 * metrics come from `computeMetrics` over the full list (recomputed lazily, at most once per tick).
 */
export class RunModel {
  readonly events: RunEvent[] = [];
  lastSeq = 0;
  /** Bumped on every applied batch so views can skip work when nothing changed. */
  rev = 0;

  strategy: StrategyName | 'unknown';
  startedAt: number | null = null;
  finishedAt: number | null = null;
  head: Version = 1;
  landings: Landing[] = [];
  totalLandings = 0;
  feed: FeedItem[] = [];
  ci: CiSnapshot | null = null;
  allGreenAt: number | null = null;
  /** Latest event timestamp seen: a floor for "now" when the server clock runs ahead of ours. */
  lastAt = 0;
  /** Description of the latest event worth showing in the formula bar. */
  lastAction: { fx: string; text: string; tone: FeedTone | 'land' } | null = null;

  /** The run's task subset (from run.started); null = the whole bank. */
  scope: Set<TaskId> | null = null;
  scopeRev = 0;
  private readonly taskById = new Map<TaskId, Task>();
  private readonly testOwners = new Set<string>();
  private readonly taskLanded = new Map<TaskId, Version>();
  private readonly everGreen = new Set<string>();
  private readonly agents = new Map<string, AgentView>();
  private overlayById = new Map<string, OverlayState>();
  private feedId = 0;
  private metricsCache: { rev: number; value: RunMetrics } | null = null;

  constructor(
    readonly runId: string,
    readonly tasks: Task[],
    strategy?: StrategyName,
  ) {
    this.strategy = strategy ?? strategyFromRunId(runId) ?? 'unknown';
    for (const t of tasks) {
      this.taskById.set(t.id, t);
      for (const f of t.tests) this.testOwners.add(f);
    }
  }

  apply(batch: SeqEvent[]): void {
    let changed = false;
    for (const { seq, event } of batch) {
      if (seq <= this.lastSeq) continue;
      this.lastSeq = seq;
      this.events.push(event);
      const at = event.type === 'notice' ? event.notice.at : event.at;
      if (at > this.lastAt) this.lastAt = at;
      this.applyOne(event);
      changed = true;
    }
    if (changed) this.rev++;
  }

  setOverlays(list: OverlayState[]): void {
    this.overlayById = new Map(list.map((o) => [o.agentId, o]));
    for (const o of list) {
      const a = this.agents.get(o.agentId);
      if (a) {
        a.pin = o.pin;
        a.readSet = o.readSet.length;
        a.writeSet = o.writeSet.length;
      }
    }
    this.rev++;
  }

  metrics(): RunMetrics {
    if (!this.metricsCache || this.metricsCache.rev !== this.rev) {
      this.metricsCache = { rev: this.rev, value: computeMetrics(this.events) };
    }
    return this.metricsCache.value;
  }

  inScope(t: Task): boolean {
    return this.scope === null || this.scope.has(t.id);
  }

  task(id: TaskId): Task | undefined {
    return this.taskById.get(id);
  }

  activeAgents(): AgentView[] {
    return [...this.agents.values()].sort((a, b) => slotOf(a.agentId) - slotOf(b.agentId) || a.startedAt - b.startedAt);
  }

  cellState(t: Task): CellState {
    const landedAt = this.taskLanded.get(t.id);
    const ci = this.ci;
    if (!ci || t.tests.length === 0) return landedAt !== undefined ? (ci && ci.version >= landedAt ? 'green' : 'landed') : 'pending';
    const failing = t.tests.some((f) => ci.failing.has(f));
    // Change orders add their own tests, so "not failing" before they land means "not there yet".
    if (!failing) return landedAt === undefined && t.kind === 'change-order' ? 'pending' : 'green';
    if (t.tests.some((f) => this.everGreen.has(f) && ci.failing.has(f))) return 'broken';
    if (landedAt === undefined) return 'pending';
    return ci.version >= landedAt ? 'failing' : 'landed';
  }

  /** Elapsed seconds of the run at wall time `now`. */
  elapsed(now: number): number {
    if (this.startedAt === null) return 0;
    return ((this.finishedAt ?? Math.max(now, this.lastAt)) - this.startedAt) / 1000;
  }

  // ------------------------------------------------------------------ event folding

  private applyOne(e: RunEvent): void {
    switch (e.type) {
      case 'run.started':
        this.startedAt = e.at;
        if (e.taskIds) {
          this.scope = new Set(e.taskIds);
          this.scopeRev++;
        }
        if (this.strategy === 'unknown') this.strategy = e.strategy;
        break;
      case 'run.finished':
        this.finishedAt = e.at;
        break;
      case 'task.started':
        this.agents.set(e.agentId, {
          agentId: e.agentId,
          taskId: e.taskId,
          startedAt: e.at,
          pin: this.overlayById.get(e.agentId)?.pin ?? this.head,
          readSet: this.overlayById.get(e.agentId)?.readSet.length ?? null,
          writeSet: this.overlayById.get(e.agentId)?.writeSet.length ?? null,
          notices: [],
          rejections: 0,
          rebases: 0,
        });
        break;
      case 'task.finished':
        this.agents.delete(e.agentId);
        if (e.outcome !== 'landed') this.push(e.at, 'reject', e.agentId, `${taskLabel(e.taskId)} ${e.outcome === 'gave-up' ? 'abandoned' : 'failed'}`, 'Attempt ended without landing');
        break;
      case 'checkpoint': {
        const a = this.agents.get(e.agentId);
        if (a) a.pin = e.to;
        break;
      }
      case 'notice':
        this.onNotice(e.notice);
        break;
      case 'landed':
        this.onLanded(e);
        break;
      case 'promotion.rejected':
        this.onRejected(e);
        break;
      case 'rebase': {
        const a = this.agents.get(e.agentId);
        if (a) {
          a.rebases++;
          a.pin = this.head;
        }
        this.push(
          e.at,
          'rebase',
          e.agentId,
          e.conflicts > 0 ? `Rebased with ${e.conflicts} conflicted ${e.conflicts === 1 ? 'file' : 'files'}` : 'Rebased cleanly',
          a ? `${taskLabel(a.taskId)} replays its branch onto v${this.head}` : `Branch replayed onto v${this.head}`,
        );
        break;
      }
      case 'ci':
        this.onCi(e);
        break;
      case 'change-order.released':
        this.push(e.at, 'release', null, `Change order released: ${taskLabel(e.taskId)}`, this.task(e.taskId)?.title ?? 'Contract change enters the queue with priority');
        this.lastAction = { fx: taskLabel(e.taskId), text: 'change order released', tone: 'release' };
        break;
      default:
        break;
    }
  }

  private onNotice(n: Notice): void {
    const a = this.agents.get(n.agentId);
    if (a) {
      a.notices.push(n);
      if (a.notices.length > 6) a.notices.shift();
    }
    if (n.severity === 'ignore') return;
    const kind =
      n.kind === 'write-write'
        ? n.mergeResult === 'merged'
          ? 'Auto-merged a concurrent edit'
          : n.mergeResult === 'conflict'
            ? 'Concurrent edit conflicts'
            : 'Concurrent edit'
        : n.kind === 'read-write'
          ? n.severity === 'interrupt'
            ? 'Signature changed under a read'
            : 'Body changed under a read'
          : n.kind === 'change-order'
            ? 'Change order touches its reads'
            : n.kind === 'impact'
              ? 'Dependent test would break'
              : 'File moved';
    this.push(n.at, n.severity, n.agentId, kind, `${n.path} in v${n.version}${n.reason ? `: ${n.reason}` : ''}`);
  }

  private onLanded(e: Ev<'landed'>): void {
    this.head = Math.max(this.head, e.version);
    if (e.agentId === 'seed') return;
    const changeOrder = !!e.taskId && this.task(e.taskId)?.kind === 'change-order';
    const l: Landing = { version: e.version, agentId: e.agentId, taskId: e.taskId, paths: e.paths, merged: e.merged, changeOrder, at: e.at };
    this.landings.push(l);
    if (this.landings.length > LANDINGS_CAP) this.landings.shift();
    this.totalLandings++;
    if (e.taskId) this.taskLanded.set(e.taskId, e.version);
    const name = taskLabel(e.taskId) || e.paths[0] || 'change';
    this.lastAction = {
      fx: name,
      text: `landed as v${e.version} by ${agentLabel(e.agentId)}${e.merged > 0 ? `, ${e.merged} auto-merged` : ''}`,
      tone: 'land',
    };
  }

  private onRejected(e: Ev<'promotion.rejected'>): void {
    const a = this.agents.get(e.agentId);
    if (a) a.rejections++;
    const task = a ? taskLabel(a.taskId) : '';
    const where = e.paths.length > 0 ? e.paths.slice(0, 2).join(', ') + (e.paths.length > 2 ? ` +${e.paths.length - 2}` : '') : '';
    switch (e.reason) {
      case 'impact-failed':
        this.push(e.at, 'caught', e.agentId, 'Breakage caught before landing', `${task} would turn dependents red${where ? ` (${where})` : ''}`);
        this.lastAction = { fx: task, text: 'blocked: breakage caught before landing', tone: 'caught' };
        break;
      case 'stale':
        this.push(e.at, 'reject', e.agentId, 'Stale: main moved under its reads', `${task} checkpoints and retests${where ? ` (${where})` : ''}`);
        break;
      case 'needs-rebase':
        this.push(e.at, 'reject', e.agentId, 'Needs rebase', `${task} is behind main${where ? ` (${where})` : ''}`);
        break;
      case 'push-rejected':
        this.push(e.at, 'reject', e.agentId, 'Push rejected', `${task}: non-fast-forward, pull and retry`);
        break;
      default:
        this.push(e.at, 'reject', e.agentId, 'Rejected', `${task}${where ? ` (${where})` : ''}`);
    }
  }

  private onCi(e: Ev<'ci'>): void {
    const failing = new Set(e.failing);
    const regressed: string[] = [];
    for (const f of failing) if (this.everGreen.has(f) && !(this.ci?.failing.has(f) ?? false)) regressed.push(f);
    for (const f of this.testOwners) if (!failing.has(f)) this.everGreen.add(f);
    this.ci = { version: e.version, passed: e.passed, failed: e.failed, failing, at: e.at };
    if (regressed.length > 0) {
      const names = regressed.slice(0, 3).map(testName).join(', ');
      this.push(e.at, 'regress', null, `CI on v${e.version}: ${regressed.length} ${regressed.length === 1 ? 'test' : 'tests'} regressed`, `${names}${regressed.length > 3 ? ` +${regressed.length - 3}` : ''} were green, now red on main`);
      this.lastAction = { fx: testName(regressed[0]!), text: `regressed on main in v${e.version}`, tone: 'regress' };
    }
    if (e.failed === 0 && this.allGreenAt === null) {
      this.allGreenAt = e.at;
      this.push(e.at, 'green', null, `All green at v${e.version}`, `${e.passed} test files pass on main`);
    }
  }

  private push(at: number, tone: FeedTone, agentId: string | null, title: string, detail: string): void {
    this.feed.push({ id: ++this.feedId, at, tone, agentId, title, detail });
    if (this.feed.length > FEED_CAP) this.feed.shift();
  }
}

function slotOf(agentId: string): number {
  const m = /-a(\d+)-/.exec(agentId);
  return m ? Number(m[1]) : 1e9;
}

function testName(path: string): string {
  const base = path.split('/').pop() ?? path;
  return base.replace(/\.test\.ts$/, '');
}
