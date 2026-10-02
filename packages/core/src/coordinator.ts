import {
  CLASS_RANK,
  type Approval,
  severityOf,
  type AgentId,
  type ChangeClass,
  type ChangePromoteRequest,
  type CheckpointBeginResponse,
  type CheckpointCommitRequest,
  type Clock,
  type ExternalLandingRequest,
  type FileChange,
  type HeadResponse,
  type IntegrateRequest,
  type IntegrateResponse,
  type Notice,
  type OverlayState,
  type PromoteRequest,
  type PromoteResponse,
  type RegisterRequest,
  type RegisterResponse,
  type RunEvent,
  type Severity,
  type StaleReason,
  type TestRunResult,
  type Version,
  type VersionRecord,
} from '@livemain/protocol';
import { globMatcher } from './glob.js';
import { SCHEMA, SCHEMA_VERSION } from './schema.js';
import { one, type SqlStore, type SqlValue } from './sql.js';

const CLASS_BY_RANK: ChangeClass[] = ['none', 'additive', 'body', 'signature'];
/** Durable Object SQLite caps bound parameters per statement at 100. */
const PARAM_CHUNK = 90;

export interface Integrator {
  integrate(req: IntegrateRequest): Promise<IntegrateResponse>;
}

export interface CoordinatorDeps {
  sql: SqlStore;
  integrator: Integrator;
  /** git remote URL of the main repo, passed to the integrator */
  remote: string;
  clock?: Clock;
  /** live fan-out of run events (dashboard WebSockets) */
  publish?: (event: RunEvent, seq: number) => void;
  /** push a notice to an agent as soon as it is created */
  deliver?: (agentId: AgentId, notice: Notice) => void;
  /** policy: globs of paths whose changes by agents need a human approval before landing */
  protectedPaths?: () => string[];
}

export class CoordinatorError extends Error {
  constructor(
    readonly code: 'not-initialized' | 'unknown-agent' | 'bad-request',
    message: string,
  ) {
    super(message);
  }
}

interface QueuedPromotion {
  run: () => Promise<PromoteResponse>;
  priority: boolean;
  seq: number;
  resolve: (r: PromoteResponse) => void;
  reject: (e: unknown) => void;
}

/** What `land` promotes: an agent's overlay, or a person's change (no overlay, no read set). */
interface Candidate {
  /** agent id, or `person:<name>` */
  actor: string;
  agent?: OverlayState;
  person?: string;
  taskId: string | null;
  pin: Version;
  readSet: string[];
  writeSet?: string[];
  changes: FileChange[];
  testsRun: string[];
  classes?: Record<string, ChangeClass>;
  message: string;
  author: string;
  priority: boolean;
  prefer?: string;
  approval?: Approval;
}

interface ApprovalRow extends Record<string, SqlValue> {
  id: string;
  agent_id: string;
  task_id: string | null;
  paths: string;
  status: string;
  requested_at: number;
  decided_by: string | null;
  decided_at: number | null;
  note: string | null;
}

function toApproval(r: ApprovalRow): Approval {
  return { id: r.id, agentId: r.agent_id, taskId: r.task_id, paths: JSON.parse(r.paths) as string[], status: r.status as Approval['status'], requestedAt: r.requested_at, decidedBy: r.decided_by, decidedAt: r.decided_at, note: r.note };
}

interface OverlayRow extends Record<string, SqlValue> {
  agent_id: string;
  task_id: string;
  strategy: string;
  workcell: string;
  pin: number;
  status: string;
  write_set: string;
  created_at: number;
  updated_at: number;
}

/**
 * The Live Main coordinator: single writer of main. Owns the version clock, overlay
 * registry, read-set index, the promotion rule and queue, and notice fan-out.
 *
 * Promotion rule: with Δ = paths changed in main since the overlay's pin,
 *   - p ∈ Δ ∩ writeSet with class ≤ additive  → auto-merged by the integrator
 *   - p ∈ Δ ∩ writeSet otherwise               → stale (agent must checkpoint)
 *   - p ∈ Δ ∩ readSet  with class ≥ body       → stale (agent must checkpoint and re-test)
 *   - otherwise                                → land without re-running the agent's tests,
 *     after running landed tests whose recorded read set touches a non-additive change.
 */
export class Coordinator {
  private readonly sql: SqlStore;
  private readonly clock: Clock;
  private readonly queue: QueuedPromotion[] = [];
  private draining = false;
  private queueSeq = 0;

  constructor(private readonly deps: CoordinatorDeps) {
    this.sql = deps.sql;
    this.clock = deps.clock ?? { now: () => Date.now() };
    this.sql.script(SCHEMA);
    this.sql.all(`INSERT OR IGNORE INTO meta (key, value) VALUES ('schema', ?)`, String(SCHEMA_VERSION));
  }

  // ------------------------------------------------------------------ lifecycle

  get initialized(): boolean {
    return this.sql.all(`SELECT version FROM versions LIMIT 1`).length > 0;
  }

  /** Records the seed commit as v1. Idempotent for the same sha. */
  init(seedSha: string): HeadResponse {
    const existing = one(this.sql.all<{ version: number; sha: string }>(`SELECT version, sha FROM versions WHERE version = 1`));
    if (existing) {
      if (existing.sha !== seedSha) throw new CoordinatorError('bad-request', `already seeded with ${existing.sha}`);
      return { version: 1, sha: seedSha };
    }
    this.insertVersion({ sha: seedSha, promotedBy: 'seed', taskId: null, changeOrder: false, changes: {} });
    return { version: 1, sha: seedSha };
  }

  head(): HeadResponse {
    const row = one(this.sql.all<{ version: number; sha: string }>(`SELECT version, sha FROM versions ORDER BY version DESC LIMIT 1`));
    if (!row) throw new CoordinatorError('not-initialized', 'main has not been seeded');
    return { version: row.version, sha: row.sha };
  }

  /** The main version whose commit is `sha`, or null. */
  versionOf(sha: string): Version | null {
    return one(this.sql.all<{ version: number }>(`SELECT version FROM versions WHERE sha = ?`, sha))?.version ?? null;
  }

  shaOf(version: Version): string {
    const row = one(this.sql.all<{ sha: string }>(`SELECT sha FROM versions WHERE version = ?`, version));
    if (!row) throw new CoordinatorError('bad-request', `unknown version v${version}`);
    return row.sha;
  }

  versions(fromVersion = 0, limit = 200): VersionRecord[] {
    const rows = this.sql.all<{ version: number; sha: string; parent: number | null; promoted_by: string; task_id: string | null; change_order: number; at: number }>(
      `SELECT * FROM versions WHERE version > ? ORDER BY version LIMIT ?`,
      fromVersion,
      limit,
    );
    return rows.map((r) => ({
      version: r.version,
      sha: r.sha,
      parent: r.parent,
      promotedBy: r.promoted_by,
      taskId: r.task_id,
      changeOrder: r.change_order === 1,
      at: r.at,
      changes: Object.fromEntries(
        this.sql
          .all<{ path: string; rank: number }>(`SELECT path, rank FROM version_paths WHERE version = ?`, r.version)
          .map((p) => [p.path, CLASS_BY_RANK[p.rank] ?? 'body']),
      ),
    }));
  }

  /** Paths changed in main in (from, to], each with the max class across those versions. */
  delta(from: Version, to: Version): Record<string, ChangeClass> {
    if (to <= from) return {};
    const rows = this.sql.all<{ path: string; r: number }>(
      `SELECT path, MAX(rank) AS r FROM version_paths WHERE version > ? AND version <= ? GROUP BY path`,
      from,
      to,
    );
    return Object.fromEntries(rows.map((row) => [row.path, CLASS_BY_RANK[row.r] ?? 'body']));
  }

  /**
   * Like delta(), restricted to `paths` (uses the (path, version) index, so the cost is
   * proportional to the agent's read/write set, not to how far behind it is).
   */
  deltaFor(from: Version, to: Version, paths: Iterable<string>): Record<string, ChangeClass> {
    const out: Record<string, ChangeClass> = {};
    if (to <= from) return out;
    const list = [...new Set(paths)];
    for (const chunk of chunks(list, PARAM_CHUNK - 2)) {
      const marks = chunk.map(() => '?').join(',');
      for (const row of this.sql.all<{ path: string; r: number }>(
        `SELECT path, MAX(rank) AS r FROM version_paths WHERE path IN (${marks}) AND version > ? AND version <= ? GROUP BY path`,
        ...chunk,
        from,
        to,
      )) {
        out[row.path] = CLASS_BY_RANK[row.r] ?? 'body';
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ overlays

  register(req: RegisterRequest): RegisterResponse {
    const head = this.head();
    const now = this.clock.now();
    this.sql.transaction(() => {
      this.sql.all(
        `INSERT INTO overlays (agent_id, task_id, strategy, workcell, pin, status, write_set, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', '[]', ?, ?)
         ON CONFLICT (agent_id) DO UPDATE SET task_id = excluded.task_id, strategy = excluded.strategy,
           workcell = excluded.workcell, pin = excluded.pin, status = 'active', write_set = '[]', updated_at = excluded.updated_at`,
        req.agentId,
        req.taskId,
        req.strategy,
        req.workcell,
        head.version,
        now,
        now,
      );
      this.replaceSets(req.agentId, [], []);
    });
    this.emit({ type: 'task.started', agentId: req.agentId, taskId: req.taskId, at: now });
    return { pin: head.version, sha: head.sha };
  }

  overlay(agentId: AgentId): OverlayState {
    const row = one(this.sql.all<OverlayRow>(`SELECT * FROM overlays WHERE agent_id = ?`, agentId));
    if (!row) throw new CoordinatorError('unknown-agent', `unknown agent ${agentId}`);
    return this.toOverlay(row);
  }

  overlays(status: OverlayState['status'] | 'all' = 'active'): OverlayState[] {
    const rows =
      status === 'all'
        ? this.sql.all<OverlayRow>(`SELECT * FROM overlays ORDER BY created_at`)
        : this.sql.all<OverlayRow>(`SELECT * FROM overlays WHERE status = ? ORDER BY created_at`, status);
    return rows.map((r) => this.toOverlay(r));
  }

  /** Report the current read/write sets between checkpoints, so fan-out reaches the agent early. */
  reportSets(agentId: AgentId, readSet: string[], writeSet: string[]): void {
    this.overlay(agentId);
    this.sql.transaction(() => this.replaceSets(agentId, readSet, writeSet));
  }

  finish(agentId: AgentId, outcome: 'landed' | 'failed' | 'gave-up'): void {
    const ov = this.overlay(agentId);
    const now = this.clock.now();
    this.sql.transaction(() => {
      if (ov.status === 'active' || ov.status === 'promoting') {
        const status = outcome === 'landed' ? 'landed' : 'abandoned';
        this.sql.all(`UPDATE overlays SET status = ?, updated_at = ? WHERE agent_id = ?`, status, now, agentId);
      }
      this.replaceSets(agentId, [], []);
    });
    this.emit({ type: 'task.finished', agentId, taskId: ov.taskId, outcome, at: now });
    this.withdrawApprovals(agentId);
  }

  /** An agent that ended no longer waits for anyone: its pending approvals are withdrawn. */
  withdrawApprovals(agentId: AgentId): void {
    for (const a of this.approvalsFor(agentId).filter((x) => x.status === 'pending')) {
      this.sql.all(`UPDATE approvals SET status = 'withdrawn', decided_at = ? WHERE id = ?`, this.clock.now(), a.id);
      this.emit({ type: 'approval', approval: { ...a, status: 'withdrawn', decidedAt: this.clock.now() }, at: this.clock.now() });
    }
  }

  // ------------------------------------------------------------------ checkpoints

  /** The new head for the agent, and what moved among the paths it read or wrote. */
  checkpointBegin(agentId: AgentId): CheckpointBeginResponse {
    const ov = this.overlay(agentId);
    const head = this.head();
    return { from: ov.pin, to: head.version, toSha: head.sha, delta: this.deltaFor(ov.pin, head.version, [...ov.readSet, ...ov.writeSet]) };
  }

  checkpointCommit(req: CheckpointCommitRequest): Notice[] {
    const ov = this.overlay(req.agentId);
    const head = this.head();
    if (req.to < ov.pin || req.to > head.version) {
      throw new CoordinatorError('bad-request', `checkpoint target v${req.to} outside [v${ov.pin}, v${head.version}]`);
    }
    const now = this.clock.now();
    const notices: Notice[] = [];
    this.sql.transaction(() => {
      this.sql.all(`UPDATE overlays SET pin = ?, updated_at = ? WHERE agent_id = ?`, req.to, now, req.agentId);
      this.replaceSets(req.agentId, req.readSet, req.writeSet);
      for (const n of req.notices) {
        notices.push(
          this.insertNotice({
            agentId: req.agentId,
            kind: n.kind,
            severity: n.severity,
            path: n.path,
            version: req.to,
            reason: n.reason,
            diff: n.diff,
            mergeResult: n.mergeResult ?? null,
            mergeMethod: n.mergeMethod ?? null,
          }),
        );
      }
    });
    this.emit({ type: 'checkpoint', agentId: req.agentId, from: ov.pin, to: req.to, notices: notices.length, at: now });
    for (const n of notices) this.emit({ type: 'notice', notice: n });
    return notices;
  }

  noticesFor(agentId: AgentId, afterId = 0): Notice[] {
    return this.noticeRows(`SELECT * FROM notices WHERE agent_id = ? AND id > ? ORDER BY id`, agentId, afterId);
  }

  /** Notices a given landing caused (who it told, and how loudly). */
  noticesAt(version: Version): Notice[] {
    return this.noticeRows(`SELECT * FROM notices WHERE version = ? ORDER BY id`, version);
  }

  private noticeRows(query: string, ...params: SqlValue[]): Notice[] {
    return this.sql
      .all<{ id: number; agent_id: string; kind: string; severity: string; path: string; version: number; reason: string; diff: string | null; merge_result: string | null; merge_method: string | null; at: number }>(query, ...params)
      .map((r) => ({
        id: String(r.id),
        agentId: r.agent_id,
        kind: r.kind as Notice['kind'],
        severity: r.severity as Severity,
        path: r.path,
        version: r.version,
        reason: r.reason,
        diff: r.diff ?? undefined,
        mergeResult: (r.merge_result as Notice['mergeResult']) ?? null,
        mergeMethod: (r.merge_method as Notice['mergeMethod']) ?? null,
        at: r.at,
      }));
  }

  // ------------------------------------------------------------------ promotion

  /** Serialized: one promotion reaches the integrator at a time; change orders jump the queue. */
  promote(req: PromoteRequest): Promise<PromoteResponse> {
    return this.enqueue(!!req.priority, () => this.processPromotion(req, !!req.priority));
  }

  /**
   * A person's change to main (a git push): no overlay, but the same queue, the same rule
   * against the version it was made on, impact tests before landing, and notices after.
   */
  promoteChange(req: ChangePromoteRequest): Promise<PromoteResponse> {
    return this.enqueue(!!req.priority, async () => {
      if (req.changes.length === 0) return { status: 'rejected', reason: 'no changes' };
      if (!one(this.sql.all(`SELECT version FROM versions WHERE version = ?`, req.base))) return { status: 'rejected', reason: `unknown base version ${req.base}` };
      return this.land({
        actor: `person:${req.person}`,
        person: req.person,
        taskId: null,
        pin: req.base,
        readSet: [],
        changes: req.changes,
        testsRun: [],
        message: req.message,
        author: `${req.person} <${req.person.includes('@') ? req.person : `${req.person}@livemain.local`}>`,
        priority: !!req.priority,
        prefer: req.commit,
      });
    });
  }

  private enqueue(priority: boolean, run: () => Promise<PromoteResponse>): Promise<PromoteResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ run, priority, seq: this.queueSeq++, resolve, reject });
      this.queue.sort((a, b) => Number(b.priority) - Number(a.priority) || a.seq - b.seq);
      void this.drain();
    });
  }

  get queueLength(): number {
    return this.queue.length;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let item = this.queue.shift(); item; item = this.queue.shift()) {
        try {
          item.resolve(await item.run());
        } catch (err) {
          item.reject(err);
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /** The promotion rule, without side effects. Exposed for tests and the synthetic swarm. */
  evaluatePromotion(req: Pick<PromoteRequest, 'readSet' | 'writeSet' | 'changes'>, pin: Version, head: Version) {
    const writes = new Set([...req.writeSet, ...req.changes.map((c) => c.path)]);
    const reads = new Set(req.readSet);
    const delta = this.deltaFor(pin, head, [...writes, ...reads]);
    const stale: StaleReason[] = [];
    const autoMerge: string[] = [];
    for (const [path, cls] of Object.entries(delta)) {
      if (writes.has(path)) {
        if (CLASS_RANK[cls] <= CLASS_RANK.additive) autoMerge.push(path);
        else stale.push({ path, why: 'write-write', class: cls });
      } else if (reads.has(path) && CLASS_RANK[cls] >= CLASS_RANK.body) {
        stale.push({ path, why: 'read-write', class: cls });
      }
    }
    return { delta, stale, autoMerge, writes };
  }

  private async processPromotion(req: PromoteRequest, priority: boolean): Promise<PromoteResponse> {
    const ov = this.overlay(req.agentId);
    if (ov.status !== 'active') return { status: 'rejected', reason: `overlay is ${ov.status}` };
    if (req.pin !== ov.pin) return { status: 'rejected', reason: `pin mismatch: overlay at v${ov.pin}, request at v${req.pin}` };
    if (req.changes.length === 0) return { status: 'rejected', reason: 'empty overlay' };
    const gate = this.approvalGate(ov, [...new Set([...req.writeSet, ...req.changes.map((c) => c.path)])]);
    if (gate && 'status' in gate) return gate;
    return this.land({
      approval: gate?.approval,
      actor: req.agentId,
      agent: ov,
      taskId: ov.taskId,
      pin: ov.pin,
      readSet: req.readSet,
      writeSet: req.writeSet,
      changes: req.changes,
      testsRun: req.testsRun,
      classes: req.classes,
      message: req.message,
      author: `${req.agentId} <${req.agentId}@livemain.local>`,
      priority,
    });
  }

  /** The promotion rule, the integrator and the landing, for an agent's overlay or a person's change. */
  private async land(c: Candidate): Promise<PromoteResponse> {
    const head = this.head();
    const agentId = c.agent?.agentId;
    const { stale, autoMerge, writes } = this.evaluatePromotion({ readSet: c.readSet, writeSet: c.writeSet ?? [], changes: c.changes }, c.pin, head.version);
    if (stale.length > 0) {
      if (agentId) this.emit({ type: 'promotion.rejected', agentId, reason: 'stale', paths: stale.map((s) => s.path), at: this.clock.now() });
      return { status: 'stale', head: head.version, reasons: stale };
    }

    const own = new Set(c.testsRun);
    const impactCandidates: Record<string, string[]> = {};
    for (const path of writes) {
      // Additive or cosmetic changes cannot break code that already passed; skip the lookup.
      const cls = c.classes?.[path];
      if (cls !== undefined && CLASS_RANK[cls] <= CLASS_RANK.additive) continue;
      const tests = this.sql
        .all<{ test_file: string }>(`SELECT test_file FROM landed_reads WHERE path = ?`, path)
        .map((r) => r.test_file)
        .filter((t) => !own.has(t));
      if (tests.length > 0) impactCandidates[path] = tests;
    }

    if (agentId) this.setStatus(agentId, 'promoting');
    let res: IntegrateResponse;
    try {
      res = await this.deps.integrator.integrate({
        remote: this.deps.remote,
        expectedHeadSha: head.sha,
        pinSha: this.shaOf(c.pin),
        changes: c.changes,
        autoMerge,
        impactTests: [],
        impactCandidates,
        message: c.message,
        author: c.author,
        ...(c.prefer ? { prefer: c.prefer } : {}),
      });
    } catch (err) {
      if (agentId) this.setStatus(agentId, 'active');
      throw err;
    }

    const now = this.clock.now();
    if (res.ok) {
      const changes: Record<string, ChangeClass> = {};
      for (const p of res.changedPaths) changes[p] = res.classes[p] ?? 'body';
      const version = this.sql.transaction(() => {
        const v = this.insertVersion({ sha: res.sha, promotedBy: c.actor, taskId: c.taskId, changeOrder: c.priority, changes });
        if (agentId) {
          this.sql.all(`UPDATE overlays SET status = 'landed', updated_at = ? WHERE agent_id = ?`, now, agentId);
          this.recordLandedReads(c.readSet, c.testsRun);
          this.replaceSets(agentId, [], []);
        }
        return v;
      });
      this.emit({
        type: 'landed',
        version,
        sha: res.sha,
        agentId: c.actor,
        taskId: c.taskId,
        paths: res.changedPaths,
        merged: res.merged.length,
        merges: res.merged,
        impactTests: res.impactRan ?? [],
        ...(c.priority ? { changeOrder: true } : {}),
        ...(c.person ? { pushedBy: c.person, title: c.message.split('\n')[0] } : {}),
        ...(c.approval ? { approval: { id: c.approval.id, by: c.approval.decidedBy ?? '', paths: c.approval.paths } } : {}),
        at: now,
      });
      if (agentId && c.taskId) this.emit({ type: 'task.finished', agentId, taskId: c.taskId, outcome: 'landed', at: now });
      this.fanOut(version, changes, c.actor, c.priority);
      return { status: 'landed', version, sha: res.sha, merged: res.merged, impactTests: res.impactRan ?? [] };
    }

    if (agentId) this.setStatus(agentId, 'active');
    switch (res.error) {
      case 'needs-checkpoint': {
        const paths = 'paths' in res ? res.paths : [];
        if (agentId) this.emit({ type: 'promotion.rejected', agentId, reason: 'stale', paths, at: now });
        return { status: 'stale', head: head.version, reasons: paths.map((path) => ({ path, why: 'write-write' as const, class: 'body' as const })) };
      }
      case 'impact-failed': {
        const results = (res as { results: TestRunResult }).results;
        const failing = results.files.filter((f) => !f.ok);
        if (agentId) {
          for (const f of failing) {
            const notice = this.insertNotice({
              agentId,
              kind: 'impact',
              severity: 'interrupt',
              path: f.file,
              version: head.version,
              reason: `your change breaks ${f.file}: ${f.failures.map((x) => `${x.name}: ${x.message}`).join(' | ').slice(0, 600)}`,
            });
            this.emit({ type: 'notice', notice });
          }
          this.emit({ type: 'promotion.rejected', agentId, reason: 'impact-failed', paths: failing.map((f) => f.file), at: now });
        }
        return { status: 'impact-failed', head: head.version, failures: failing };
      }
      default: {
        const message = 'message' in res && res.message ? `${res.error}: ${res.message}` : res.error;
        if (agentId) this.emit({ type: 'promotion.rejected', agentId, reason: 'rejected', paths: [], at: now });
        return { status: 'rejected', reason: message };
      }
    }
  }

  // ------------------------------------------------------------------ approvals

  /**
   * Policy gate for an agent's landing: changes to protected paths need a human approval. Returns
   * null (no protected path), the approval that allows it, or the response to send instead.
   */
  private approvalGate(ov: OverlayState, paths: string[]): { approval: Approval } | PromoteResponse | null {
    const globs = this.deps.protectedPaths?.() ?? [];
    if (globs.length === 0) return null;
    const isProtected = globMatcher(globs);
    const hit = paths.filter(isProtected).sort();
    if (hit.length === 0) return null;
    const latest = this.approvalsFor(ov.agentId)[0];
    const covers = (a: Approval) => hit.every((p) => a.paths.includes(p));
    if (latest?.status === 'approved' && covers(latest)) return { approval: latest };
    if (latest?.status === 'rejected' && covers(latest)) {
      return { status: 'rejected', reason: `a reviewer rejected the change to ${latest.paths.join(', ')}${latest.note ? `: ${latest.note}` : ''}` };
    }
    let approval: Approval;
    if (latest?.status === 'pending') {
      if (covers(latest)) return { status: 'awaiting-approval', approvalId: latest.id, paths: latest.paths };
      const union = [...new Set([...latest.paths, ...hit])].sort();
      this.sql.all(`UPDATE approvals SET paths = ? WHERE id = ?`, JSON.stringify(union), latest.id);
      approval = { ...latest, paths: union };
    } else {
      approval = { id: `ap-${this.clock.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, agentId: ov.agentId, taskId: ov.taskId, paths: hit, status: 'pending', requestedAt: this.clock.now(), decidedBy: null, decidedAt: null, note: null };
      this.sql.all(`INSERT INTO approvals (id, agent_id, task_id, paths, status, requested_at) VALUES (?, ?, ?, ?, 'pending', ?)`, approval.id, approval.agentId, approval.taskId, JSON.stringify(approval.paths), approval.requestedAt);
    }
    this.emit({ type: 'approval', approval, at: this.clock.now() });
    return { status: 'awaiting-approval', approvalId: approval.id, paths: approval.paths };
  }

  approvals(status?: Approval['status']): Approval[] {
    const rows = status
      ? this.sql.all<ApprovalRow>(`SELECT * FROM approvals WHERE status = ? ORDER BY requested_at DESC`, status)
      : this.sql.all<ApprovalRow>(`SELECT * FROM approvals ORDER BY requested_at DESC LIMIT 200`);
    return rows.map(toApproval);
  }

  private approvalsFor(agentId: AgentId): Approval[] {
    return this.sql.all<ApprovalRow>(`SELECT * FROM approvals WHERE agent_id = ? ORDER BY requested_at DESC`, agentId).map(toApproval);
  }

  /** A person approves or rejects; the agent's next submit lands (or is told why not). */
  decide(id: string, approve: boolean, by: string, note?: string): Approval {
    const row = one(this.sql.all<ApprovalRow>(`SELECT * FROM approvals WHERE id = ?`, id));
    if (!row) throw new CoordinatorError('bad-request', `no approval ${id}`);
    if (row.status !== 'pending') throw new CoordinatorError('bad-request', `approval ${id} was already ${row.status}`);
    const now = this.clock.now();
    this.sql.all(`UPDATE approvals SET status = ?, decided_by = ?, decided_at = ?, note = ? WHERE id = ?`, approve ? 'approved' : 'rejected', by, now, note?.trim() || null, id);
    const approval = toApproval(one(this.sql.all<ApprovalRow>(`SELECT * FROM approvals WHERE id = ?`, id))!);
    this.emit({ type: 'approval', approval, at: now });
    return approval;
  }

  /** Tell active overlays that read or wrote a changed path. Ignorable changes are not sent. */
  private fanOut(version: Version, changes: Record<string, ChangeClass>, promoter: AgentId, changeOrder: boolean): void {
    // Additive/cosmetic changes never produce a notice (readers: ignore; writers: auto-merge),
    // so hot append-only files like registries cost nothing here.
    const paths = Object.keys(changes).filter((p) => CLASS_RANK[changes[p] ?? 'body'] >= CLASS_RANK.body);
    if (paths.length === 0) return;
    const hits = new Map<string, { agentId: string; path: string; write: boolean }>();
    for (const chunk of chunks(paths, PARAM_CHUNK)) {
      const marks = chunk.map(() => '?').join(',');
      for (const r of this.sql.all<{ agent_id: string; path: string }>(
        `SELECT r.agent_id, r.path FROM overlay_reads r JOIN overlays o ON o.agent_id = r.agent_id
         WHERE o.status = 'active' AND r.path IN (${marks})`,
        ...chunk,
      )) {
        hits.set(`${r.agent_id}\0${r.path}`, { agentId: r.agent_id, path: r.path, write: false });
      }
      for (const r of this.sql.all<{ agent_id: string; path: string }>(
        `SELECT w.agent_id, w.path FROM overlay_writes w JOIN overlays o ON o.agent_id = w.agent_id
         WHERE o.status = 'active' AND w.path IN (${marks})`,
        ...chunk,
      )) {
        hits.set(`${r.agent_id}\0${r.path}`, { agentId: r.agent_id, path: r.path, write: true });
      }
    }
    for (const hit of hits.values()) {
      if (hit.agentId === promoter) continue;
      const cls = changes[hit.path] ?? 'body';
      let severity: Severity;
      let reason: string;
      if (hit.write) {
        severity = CLASS_RANK[cls] <= CLASS_RANK.additive ? 'ignore' : 'review';
        reason = `main v${version} changed ${hit.path}, which you also edited (${cls}); checkpoint to merge`;
      } else {
        severity = changeOrder && CLASS_RANK[cls] >= CLASS_RANK.body ? 'interrupt' : severityOf(cls);
        reason = `main v${version} changed ${hit.path}, which you read (${cls}${changeOrder ? ', change order' : ''})`;
      }
      if (severity === 'ignore') continue;
      const notice = this.insertNotice({
        agentId: hit.agentId,
        kind: changeOrder ? 'change-order' : 'moved',
        severity,
        path: hit.path,
        version,
        reason,
      });
      this.emit({ type: 'notice', notice });
    }
  }

  // ------------------------------------------------------------------ baselines + CI

  /** Baseline strategies land by pushing directly; they report the landing here for metrics. */
  recordExternalLanding(req: ExternalLandingRequest): Version {
    const now = this.clock.now();
    const existing = one(this.sql.all<{ version: number }>(`SELECT version FROM versions WHERE sha = ?`, req.sha));
    if (existing) return existing.version;
    const version = this.sql.transaction(() =>
      this.insertVersion({ sha: req.sha, promotedBy: req.agentId, taskId: req.taskId, changeOrder: false, changes: req.changes }),
    );
    this.emit({ type: 'landed', version, sha: req.sha, agentId: req.agentId, taskId: req.taskId, paths: Object.keys(req.changes), merged: 0, at: now });
    return version;
  }

  recordCi(version: Version, sha: string, result: Pick<TestRunResult, 'passed' | 'failed' | 'files'>): void {
    const failing = result.files.filter((f) => !f.ok).map((f) => f.file);
    const now = this.clock.now();
    this.sql.all(
      `INSERT OR REPLACE INTO ci (version, sha, passed, failed, failing, at) VALUES (?, ?, ?, ?, ?, ?)`,
      version,
      sha,
      result.passed,
      result.failed,
      JSON.stringify(failing),
      now,
    );
    this.emit({ type: 'ci', version, sha, passed: result.passed, failed: result.failed, failing, at: now });
  }

  latestCi(): { version: number; sha: string; passed: number; failed: number; failing: string[] } | null {
    const row = one(this.sql.all<{ version: number; sha: string; passed: number; failed: number; failing: string }>(`SELECT * FROM ci ORDER BY version DESC LIMIT 1`));
    return row ? { ...row, failing: JSON.parse(row.failing) as string[] } : null;
  }

  // ------------------------------------------------------------------ events

  emit(event: RunEvent): number {
    const rows = this.sql.all<{ seq: number }>(
      `INSERT INTO events (at, type, body) VALUES (?, ?, ?) RETURNING seq`,
      'at' in event ? event.at : this.clock.now(),
      event.type,
      JSON.stringify(event),
    );
    const seq = rows[0]?.seq ?? 0;
    this.deps.publish?.(event, seq);
    if (event.type === 'notice') this.deps.deliver?.(event.notice.agentId, event.notice);
    return seq;
  }

  events(afterSeq = 0, limit = 1000): { seq: number; event: RunEvent }[] {
    return this.sql
      .all<{ seq: number; body: string }>(`SELECT seq, body FROM events WHERE seq > ? ORDER BY seq LIMIT ?`, afterSeq, limit)
      .map((r) => ({ seq: r.seq, event: JSON.parse(r.body) as RunEvent }));
  }

  stats() {
    const count = (q: string, ...p: SqlValue[]) => Number(one(this.sql.all<{ n: number }>(q, ...p))?.n ?? 0);
    return {
      head: this.initialized ? this.head() : null,
      activeOverlays: count(`SELECT COUNT(*) AS n FROM overlays WHERE status = 'active'`),
      landed: count(`SELECT COUNT(*) AS n FROM overlays WHERE status = 'landed'`),
      notices: count(`SELECT COUNT(*) AS n FROM notices`),
      queue: this.queue.length,
      ci: this.latestCi(),
    };
  }

  // ------------------------------------------------------------------ internals

  private insertVersion(v: { sha: string; promotedBy: string; taskId: string | null; changeOrder: boolean; changes: Record<string, ChangeClass> }): Version {
    const prev = one(this.sql.all<{ version: number }>(`SELECT version FROM versions ORDER BY version DESC LIMIT 1`));
    const version = (prev?.version ?? 0) + 1;
    this.sql.all(
      `INSERT INTO versions (version, sha, parent, promoted_by, task_id, change_order, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      version,
      v.sha,
      prev?.version ?? null,
      v.promotedBy,
      v.taskId,
      v.changeOrder ? 1 : 0,
      this.clock.now(),
    );
    for (const [path, cls] of Object.entries(v.changes)) {
      this.sql.all(`INSERT INTO version_paths (version, path, rank) VALUES (?, ?, ?)`, version, path, CLASS_RANK[cls]);
    }
    return version;
  }

  private replaceSets(agentId: AgentId, readSet: string[], writeSet: string[]): void {
    this.sql.all(`DELETE FROM overlay_reads WHERE agent_id = ?`, agentId);
    this.sql.all(`DELETE FROM overlay_writes WHERE agent_id = ?`, agentId);
    this.insertPairs('overlay_reads', agentId, [...new Set(readSet)]);
    this.insertPairs('overlay_writes', agentId, [...new Set(writeSet)]);
    this.sql.all(`UPDATE overlays SET write_set = ? WHERE agent_id = ?`, JSON.stringify([...new Set(writeSet)].sort()), agentId);
  }

  private insertPairs(table: 'overlay_reads' | 'overlay_writes', agentId: AgentId, paths: string[]): void {
    for (const chunk of chunks(paths, PARAM_CHUNK / 2)) {
      const values = chunk.map(() => '(?, ?)').join(',');
      this.sql.all(`INSERT OR IGNORE INTO ${table} (agent_id, path) VALUES ${values}`, ...chunk.flatMap((p) => [agentId, p]));
    }
  }

  private recordLandedReads(readSet: string[], tests: string[]): void {
    for (const test of tests) {
      for (const chunk of chunks(readSet, PARAM_CHUNK / 2)) {
        const values = chunk.map(() => '(?, ?)').join(',');
        this.sql.all(`INSERT OR IGNORE INTO landed_reads (path, test_file) VALUES ${values}`, ...chunk.flatMap((p) => [p, test]));
      }
    }
  }

  private insertNotice(n: Omit<Notice, 'id' | 'at'>): Notice {
    const at = this.clock.now();
    const rows = this.sql.all<{ id: number }>(
      `INSERT INTO notices (agent_id, kind, severity, path, version, reason, diff, merge_result, merge_method, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      n.agentId,
      n.kind,
      n.severity,
      n.path,
      n.version,
      n.reason,
      n.diff ?? null,
      n.mergeResult ?? null,
      n.mergeMethod ?? null,
      at,
    );
    return { ...n, id: String(rows[0]?.id ?? 0), at };
  }

  private setStatus(agentId: AgentId, status: OverlayState['status']): void {
    this.sql.all(`UPDATE overlays SET status = ?, updated_at = ? WHERE agent_id = ?`, status, this.clock.now(), agentId);
  }

  private toOverlay(row: OverlayRow): OverlayState {
    return {
      agentId: row.agent_id,
      taskId: row.task_id,
      strategy: row.strategy as OverlayState['strategy'],
      workcell: row.workcell,
      pin: row.pin,
      status: row.status as OverlayState['status'],
      writeSet: JSON.parse(row.write_set) as string[],
      readSet: this.sql
        .all<{ path: string }>(`SELECT path FROM overlay_reads WHERE agent_id = ? ORDER BY path`, row.agent_id)
        .map((r) => r.path),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function chunks<T>(xs: T[], n: number): T[][] {
  const size = Math.max(1, Math.floor(n));
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
