import type { Task, TaskId } from '@livemain/protocol';

export type TaskStatus = 'pending' | 'running' | 'landed' | 'failed' | 'blocked';

const FINISHED = new Set<TaskStatus>(['landed', 'failed', 'blocked']);

/**
 * Decides which task runs next. Deterministic and strategy-independent, so every
 * strategy faces the same work in the same order:
 *  - a task is ready when all its dependencies have landed;
 *  - change orders are released when `releaseAt` of the non-change-order tasks have landed
 *    (progress-based, not wall-clock, so slow and fast strategies see the same contention);
 *  - released change orders and helpers go first (contracts before features), then the rest
 *    in bank order;
 *  - traps wait until the in-scope tasks they would break have finished, so a naive trap
 *    meets landed code it can break (the regression check under test), not an empty repo;
 *  - tasks whose dependency failed are blocked.
 */
export class Scheduler {
  private readonly status = new Map<TaskId, TaskStatus>();
  private readonly byId = new Map<TaskId, Task>();
  private readonly regularTotal: number;
  private released = new Set<TaskId>();
  private releaseLog: Task[] = [];
  private contracts = new Set<TaskId>();
  private readonly waitFor = new Map<TaskId, TaskId[]>();

  constructor(private readonly tasks: Task[]) {
    for (const t of tasks) {
      this.byId.set(t.id, t);
      this.status.set(t.id, 'pending');
    }
    for (const t of tasks) {
      for (const d of t.dependsOn) if (!this.byId.has(d)) throw new Error(`task ${t.id} depends on unknown ${d}`);
    }
    this.regularTotal = tasks.filter((t) => t.kind !== 'change-order').length || 1;
    for (const t of tasks) {
      if (t.kind !== 'trap') continue;
      const victims = (t.breaks ?? []).filter((v) => {
        const victim = this.byId.get(v);
        return victim && victim.kind !== 'change-order' && !this.dependsTransitively(v, t.id);
      });
      this.waitFor.set(t.id, victims);
    }
  }

  private dependsTransitively(id: TaskId, on: TaskId, seen = new Set<TaskId>()): boolean {
    if (seen.has(id)) return false;
    seen.add(id);
    return this.get(id).dependsOn.some((d) => d === on || this.dependsTransitively(d, on, seen));
  }

  /** Serializable state (for a Durable Object that outlives a single request). */
  snapshot(): { status: [TaskId, TaskStatus][]; released: TaskId[] } {
    return { status: [...this.status.entries()], released: [...this.released] };
  }

  restore(snap: { status: [TaskId, TaskStatus][]; released: TaskId[] }): void {
    for (const [id, st] of snap.status) if (this.byId.has(id)) this.status.set(id, st);
    this.released = new Set(snap.released);
    this.releaseLog = [];
  }

  get(id: TaskId): Task {
    const t = this.byId.get(id);
    if (!t) throw new Error(`unknown task ${id}`);
    return t;
  }

  statusOf(id: TaskId): TaskStatus {
    return this.status.get(id) ?? 'pending';
  }

  counts(): Record<TaskStatus, number> {
    const c: Record<TaskStatus, number> = { pending: 0, running: 0, landed: 0, failed: 0, blocked: 0 };
    for (const s of this.status.values()) c[s]++;
    return c;
  }

  /** fraction of regular (non change-order) tasks landed */
  progress(): number {
    let landed = 0;
    for (const t of this.tasks) if (t.kind !== 'change-order' && this.status.get(t.id) === 'landed') landed++;
    return landed / this.regularTotal;
  }

  /** Release change orders whose progress threshold has been reached. */
  private releaseDue(): void {
    const p = this.progress();
    for (const t of this.tasks) {
      if (t.kind === 'change-order' && !this.released.has(t.id) && (t.releaseAt ?? 0) <= p) this.release(t);
    }
  }

  private release(t: Task): void {
    this.released.add(t.id);
    this.releaseLog.push(t);
  }

  /** Change orders released since the last call (for run events). */
  takeReleased(): Task[] {
    this.releaseDue();
    const out = this.releaseLog;
    this.releaseLog = [];
    return out;
  }

  /** Next ready task, or null if none is ready right now. Marks it running. */
  next(): Task | null {
    this.releaseDue();
    // The change-order lane is serialized: contract changes touch shared code broadly, so
    // two in flight at once would keep invalidating each other.
    const changeOrderRunning = this.tasks.some((t) => t.kind === 'change-order' && this.status.get(t.id) === 'running');
    let best: Task | null = null;
    let bestRank = Infinity;
    for (const [i, t] of this.tasks.entries()) {
      if (this.status.get(t.id) !== 'pending') continue;
      if (t.kind === 'change-order' && (!this.released.has(t.id) || changeOrderRunning)) continue;
      if (!t.dependsOn.every((d) => this.status.get(d) === 'landed')) continue;
      if (!(this.waitFor.get(t.id) ?? []).every((v) => FINISHED.has(this.statusOf(v)))) continue;
      const rank = this.priority(t) * 1e6 + i;
      if (rank < bestRank) {
        best = t;
        bestRank = rank;
      }
    }
    if (best) this.status.set(best.id, 'running');
    return best;
  }

  /** change orders, then planner-tagged contract work, then helpers, then leaves */
  private priority(t: Task): number {
    if (t.kind === 'change-order') return 0;
    if (this.contracts.has(t.id) || t.contract) return 1;
    return t.kind === 'helper' ? 2 : 3;
  }

  /** Planner output: tasks that touch load-bearing code (re-evaluated as history accumulates). */
  setContracts(ids: Iterable<TaskId>): void {
    this.contracts = new Set(ids);
  }

  finish(id: TaskId, outcome: 'landed' | 'failed'): void {
    this.status.set(id, outcome);
    if (outcome === 'failed') this.blockDependents(id);
  }

  /** When everything else is finished, release remaining change orders regardless of progress. */
  releaseAll(): void {
    for (const t of this.tasks) if (t.kind === 'change-order' && !this.released.has(t.id)) this.release(t);
  }

  private blockDependents(id: TaskId): void {
    for (const t of this.tasks) {
      if (this.status.get(t.id) === 'pending' && t.dependsOn.includes(id)) {
        this.status.set(t.id, 'blocked');
        this.blockDependents(t.id);
      }
    }
  }
}
