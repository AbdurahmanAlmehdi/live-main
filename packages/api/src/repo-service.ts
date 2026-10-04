import { AGENT_TOOLS, agentBrief, LiveMainStrategy } from '@livemain/agent';
import { Coordinator, one, type SqlStore } from '@livemain/core';
import {
  type AgentToolResult,
  type Approval,
  type ClaimedTask,
  type ApprovalView,
  type CloneAccess,
  type RepoPolicy,
  FINAL_AGENT_STATES,
  type AgentDetail,
  type AgentState,
  type AgentSummary,
  type Budget,
  type ChangeClass,
  type CreateTaskRequest,
  type DispatchEstimate,
  type DispatchRequest,
  type FilePatch,
  type FileStat,
  type FileView,
  type Landing,
  type LandingDetail,
  type MarginNote,
  type ProviderId,
  type Repo,
  type RepoEvent,
  type RunEvent,
  type Swarm,
  type SwarmCounts,
  type SwarmStatus,
  type Task,
  type TaskStatus,
  type TaskV1,
  type TreeEntry,
  type Worker,
} from '@livemain/protocol';
import { PROVIDERS } from '@livemain/protocol';
import { CiLoop } from './ci.js';
import { overlayPatch, parsePatch, statOf } from './diff.js';
import { GitGateway, type PushedMain, type PushReport } from './git-gateway.js';
import { ApiError, notFound } from './errors.js';
import type { RepoDeps, RepoRecord, SwarmHandle, SwarmRunner } from './ports.js';
import { Projector } from './projector.js';
import { REPO_MIGRATIONS, REPO_SCHEMA } from './schema.js';
import { SwarmRun, type SwarmRunDeps } from './swarm-run.js';
import { agentView, kindOf, landingView, swarmView, taskView, type AgentRow, type LandingRow, type SwarmRow, type TaskRow } from './views.js';

/**
 * One repository: its live main (the coordinator), CI, tasks, swarms, agents and landings,
 * all in the repo's own database. A Durable Object (RepoDO) on Cloudflare; in process locally.
 */
export class RepoService {
  readonly record: RepoRecord;
  private readonly sql: SqlStore;
  private readonly coord: Coordinator;
  private readonly ci: CiLoop;
  private readonly projector: Projector;
  private readonly runs = new Map<string, SwarmHandle>();
  private readonly subscribers = new Set<(e: RepoEvent) => void>();
  private readonly now: () => number;
  private readonly log: (line: string) => void;
  private readonly runner: SwarmRunner;

  private gateway: GitGateway | null = null;

  constructor(private readonly d: RepoDeps) {
    this.record = d.record;
    this.sql = d.sql;
    this.now = d.now ?? (() => Date.now());
    this.log = d.log ?? (() => undefined);
    this.coord = new Coordinator({ sql: d.sql, integrator: d.integrator, remote: d.record.remote, publish: (event) => this.onEvent(event), protectedPaths: () => this.policy().protectedPaths });
    this.sql.script(REPO_SCHEMA);
    for (const m of REPO_MIGRATIONS) {
      try {
        this.sql.script(m);
      } catch {
        // already applied
      }
    }
    this.projector = new Projector(this.sql);
    this.ci = new CiLoop(this.coord, d.integrator, d.record.remote, (s) => this.log(`[${d.record.id}] ${s}`), () => this.ciScope());
    this.runner = d.runner ?? { start: (deps) => new SwarmRun(deps) };
    if (!this.runner.durable) {
      // In-process swarms die with the process: if this service restarted, their agents are gone.
      const at = this.now();
      this.sql.all(`UPDATE swarms SET status = 'stopped', reason = 'the server restarted', finished_at = ? WHERE status IN ('running', 'paused', 'stopping')`, at);
      this.sql.all(`UPDATE agents SET state = 'stopped', detail = 'the server restarted', finished_at = ? WHERE state NOT IN ('landed', 'gave-up', 'stopped', 'error')`, at);
      this.sql.all(`UPDATE tasks SET status = 'open', swarm_id = NULL WHERE status IN ('queued', 'running')`);
      this.sql.all(`UPDATE approvals SET status = 'withdrawn', decided_at = ? WHERE status = 'pending'`, at);
    }
    if (this.coord.initialized) this.ci.start();
  }

  /** Smart-HTTP git for people (`git clone`, `git push`), on behalf of an authenticated person. */
  git(req: Request, rest: string, person: string): Promise<Response> {
    this.gateway ??= new GitGateway({
      git: this.d.git,
      repo: this.record.id,
      promote: (p) => this.promotePush(p),
      fetched: (who) => {
        if (this.coord.initialized) this.sql.all(`INSERT OR REPLACE INTO git_fetches (person, sha, at) VALUES (?, ?, ?)`, who, this.coord.head().sha, this.now());
      },
      lastFetched: (who) => one(this.sql.all<{ sha: string }>(`SELECT sha FROM git_fetches WHERE person = ?`, who))?.sha ?? null,
    });
    return this.gateway.handle(req, rest, person);
  }

  /**
   * A person's push to main: the change from their base to the pushed commit, promoted like an
   * agent's overlay. The report becomes `git push` output.
   */
  private async promotePush(p: PushedMain): Promise<PushReport> {
    const base = this.coord.versionOf(p.oldSha) ?? (await this.newestVersionIn(p.newSha));
    if (base === null) {
      return { ok: false, reason: 'fetch first', lines: [`Live Main: your main (${p.oldSha.slice(0, 7)}) is not a version of main. Run \`git pull --rebase\` and push again.`] };
    }
    const id = this.record.id;
    const patches = parsePatch(await this.d.git.diff(id, p.newSha, p.oldSha));
    const binary = patches.filter((f) => f.binary).map((f) => f.path);
    if (binary.length > 0) return { ok: false, reason: 'binary files are not supported yet', lines: [`Live Main: binary files cannot land through a push yet: ${binary.join(', ')}`] };
    if (patches.length === 0) return { ok: true, lines: ['Live Main: nothing to land (no changes against main).'] };
    const changes = await Promise.all(patches.map(async (f) => ({ path: f.path, content: f.status === 'deleted' ? null : await this.d.git.file(id, p.newSha, f.path) })));
    const subject = (await this.d.git.log(id, p.newSha, { max: 1 }).catch(() => []))[0]?.subject ?? `Push by ${p.person}`;
    const res = await this.coord.promoteChange({ person: p.person, base, changes, message: subject, commit: p.newSha, priority: p.changeOrder });

    switch (res.status) {
      case 'landed': {
        const lines = [`Live Main: landed as v${res.version} (${res.sha.slice(0, 7)})${p.changeOrder ? ' as a change order' : ''}: ${subject}`];
        for (const m of res.merged) lines.push(`  merged ${m.path} onto newer main (${m.method})`);
        if (res.impactTests.length > 0) lines.push(`  ran ${res.impactTests.length} impact test file(s) before landing: passing`);
        const notices = this.coord.noticesAt(res.version);
        const agents = [...new Set(notices.map((n) => n.agentId))];
        if (agents.length > 0) {
          const paths = [...new Set(notices.map((n) => n.path))];
          lines.push(`  notified ${agents.length} agent(s) working on ${paths.join(', ')}: ${agents.join(', ')}`);
        }
        if (res.sha !== p.newSha) lines.push('  main is a new commit with your change merged; run `git pull --rebase` to sync.');
        return { ok: true, lines };
      }
      case 'stale':
        return {
          ok: false,
          reason: 'conflicts with newer main',
          lines: [
            `Live Main: main moved past your base v${base} (now v${res.head}) on files you changed:`,
            ...res.reasons.map((r) => `  ${r.path}: changed on main (${r.class})`),
            '  run `git pull --rebase`, resolve, and push again.',
          ],
        };
      case 'impact-failed':
        return {
          ok: false,
          reason: 'breaks tests already on main',
          lines: [
            'Live Main: refused before landing; your change breaks tests that pass on main:',
            ...res.failures.map((f) => `  ${f.file}: ${f.failures.map((x) => `${x.name}: ${x.message.split('\n')[0]}`).join(' | ').slice(0, 300)}`),
          ],
        };
      case 'awaiting-approval': // people's pushes are not held for approval
      default: {
        const reason = 'reason' in res ? res.reason : 'not landed';
        return { ok: false, reason, lines: [`Live Main: ${reason}`] };
      }
    }
  }

  /** The newest main version in a commit's first-parent history (a push's base when its old main is unknown). */
  private async newestVersionIn(sha: string): Promise<number | null> {
    for (const c of await this.d.git.log(this.record.id, sha, { max: 200 }).catch(() => [])) {
      const v = this.coord.versionOf(c.sha);
      if (v !== null) return v;
    }
    return null;
  }

  /** The repo's coordinator (agents on other Durable Objects reach it over its HTTP API). */
  get coordinator(): Coordinator {
    return this.coord;
  }

  /** Run post-land CI once now (durable runtimes call this from their alarm). */
  ciOnce(): Promise<void> {
    return this.ci.once();
  }

  /** First commit of a new repository becomes main v1; template tasks become open tasks. */
  init(seed: { sha: string; title: string; tasks: Task[] }): void {
    this.coord.init(seed.sha);
    const at = this.now();
    this.sql.transaction(() => {
      this.sql.all(`INSERT OR IGNORE INTO landings (version, sha, at, title, by, files) VALUES (1, ?, ?, ?, ?, '[]')`, seed.sha, at, seed.title, JSON.stringify({ kind: 'seed' }));
      seed.tasks.forEach((t, i) => this.insertTask(t, 'template', i, at));
    });
    this.ci.start();
  }

  /** Template repos ship acceptance tests for work not done yet: CI covers core + landed tasks. */
  private ciScope(): string[] | undefined {
    if (!this.d.template) return undefined;
    const tests = this.sql.all<{ spec: string }>(`SELECT spec FROM tasks WHERE status = 'landed'`).flatMap((t) => (JSON.parse(t.spec) as Task).tests);
    return ['tests/core/', ...new Set(tests.filter((f) => !f.startsWith('tests/core/')))];
  }

  view(): Repo {
    const r = this.record;
    const head = this.coord.initialized ? this.coord.head() : null;
    const headAt = head ? (one(this.sql.all<{ at: number }>(`SELECT at FROM landings WHERE version = ?`, head.version))?.at ?? r.createdAt) : null;
    const today = new Date(this.now());
    today.setHours(0, 0, 0, 0);
    const count = (q: string, ...params: (string | number)[]) => Number(one(this.sql.all<{ n: number }>(q, ...params))?.n ?? 0);
    const last = one(this.sql.all<{ at: number }>(`SELECT at FROM landings WHERE version > 1 ORDER BY version DESC LIMIT 1`));
    return {
      id: r.id,
      owner: r.owner,
      name: r.name,
      fullName: `${r.owner}/${r.name}`,
      description: r.description,
      source: r.source,
      template: r.template,
      cloneUrl: r.cloneUrl,
      createdAt: r.createdAt,
      main: head ? { version: head.version, sha: head.sha, at: headAt ?? r.createdAt } : null,
      activity: {
        activeAgents: count(`SELECT COUNT(*) AS n FROM agents WHERE state NOT IN ('landed', 'gave-up', 'stopped', 'error')`),
        activeSwarms: count(`SELECT COUNT(*) AS n FROM swarms WHERE status IN ('running', 'paused', 'stopping')`),
        approaching: count(`SELECT COUNT(*) AS n FROM agents WHERE state = 'ready'`),
        landingsToday: count(`SELECT COUNT(*) AS n FROM landings WHERE version > 1 AND at >= ?`, today.getTime()),
        guardsToday: count(`SELECT COUNT(*) AS n FROM agent_log WHERE kind = 'guard' AND at >= ?`, today.getTime()),
        lastLandingAt: last?.at ?? null,
      },
    };
  }

  // ------------------------------------------------------------------ code

  async tree(ref?: string): Promise<TreeEntry[]> {
    const at = ref ?? this.coord.head().sha;
    const entries = await this.d.git.tree(this.record.id, at);
    const writers = new Map<string, Set<string>>();
    const readers = new Map<string, Set<string>>();
    const add = (m: Map<string, Set<string>>, path: string, agent: string) => {
      const parts = path.split('/');
      for (let i = 1; i <= parts.length; i++) {
        const key = parts.slice(0, i).join('/');
        let set = m.get(key);
        if (!set) m.set(key, (set = new Set()));
        set.add(agent);
      }
    };
    if (!ref) {
      for (const ov of this.coord.overlays('active')) {
        for (const p of ov.writeSet) add(writers, p, ov.agentId);
        for (const p of ov.readSet) add(readers, p, ov.agentId);
      }
    }
    const listed = new Set(entries.map((e) => e.path));
    // Files agents are creating do not exist on main yet: show them as pending entries.
    const pending = [...writers.keys()].filter((p) => !listed.has(p) && !entries.some((e) => e.path.startsWith(`${p}/`)) && ![...writers.keys()].some((k) => k.startsWith(`${p}/`)));
    return [
      ...entries.map((e) => ({ path: e.path, name: e.path.split('/').pop()!, type: e.type, size: e.size, writers: writers.get(e.path)?.size ?? 0, readers: readers.get(e.path)?.size ?? 0 })),
      ...pending.map((p) => ({ path: p, name: p.split('/').pop()!, type: 'file' as const, size: null, writers: writers.get(p)?.size ?? 0, readers: 0 })),
    ];
  }

  /** A clone URL for people (with a short-lived read token on hosts that need one). */
  async cloneAccess(): Promise<CloneAccess> {
    return (await this.d.git.cloneAccess?.(this.record.id)) ?? { url: this.record.cloneUrl, expiresAt: null };
  }

  /**
   * The landing that last changed path, at or before sha. Every change to main is a landing,
   * so this is a table lookup rather than a path-filtered git log (which Artifacts lacks);
   * the seed (version 1) covers files nothing has touched since. Refs that are not landings
   * fall back to the git host.
   */
  private async lastLandingOf(path: string, sha: string): Promise<LandingRow | undefined> {
    const at = one(this.sql.all<{ version: number }>(`SELECT version FROM landings WHERE sha = ?`, sha))?.version;
    if (at === undefined) {
      const lastLog = await this.d.git.log(this.record.id, sha, { path, max: 1 }).catch(() => []);
      return lastLog[0] ? one(this.sql.all<LandingRow>(`SELECT * FROM landings WHERE sha = ?`, lastLog[0].sha)) : undefined;
    }
    return one(
      this.sql.all<LandingRow>(
        `SELECT * FROM landings WHERE version <= ? AND (version = 1 OR EXISTS (SELECT 1 FROM json_each(landings.files) WHERE json_extract(value, '$.path') = ?)) ORDER BY version DESC LIMIT 1`,
        at,
        path,
      ),
    );
  }

  async file(path: string, ref?: string): Promise<FileView> {
    const head = this.coord.head();
    const sha = ref ?? head.sha;
    const content = await this.d.git.file(this.record.id, sha, path);
    const writersActive = ref ? [] : this.coord.overlays('active').filter((o) => o.writeSet.includes(path));
    if (content === null && writersActive.length === 0) throw notFound(path);
    const readers = ref ? 0 : this.coord.overlays('active').filter((o) => o.readSet.includes(path)).length;
    const lastLanding = await this.lastLandingOf(path, sha);
    const notes: MarginNote[] = [];
    const writers: FileView['writers'] = [];
    for (const ov of writersActive) {
      const agent = this.agentRow(ov.agentId);
      const title = agent ? this.taskTitle(agent.task_id) : ov.taskId;
      const state = (agent?.state ?? 'working') as AgentState;
      writers.push({ agentId: ov.agentId, taskTitle: title, state });
      const overlay = await this.overlayOf(ov.agentId, ov.workcell);
      const change = overlay?.changes.find((c) => c.path === path);
      if (!change || !overlay) continue;
      const pinned = await this.d.git.file(this.record.id, overlay.pinSha, path).catch(() => content);
      const patch = overlayPatch(path, pinned, content, change.content, (overlay.classes?.[path] as ChangeClass | undefined) ?? 'body');
      // Margin notes sit on main's lines: a patch against the pin has no place there.
      if (patch.against === 'pin') continue;
      for (const hunk of patch.hunks) {
        notes.push({ agentId: ov.agentId, taskTitle: title, state, worker: agent ? (JSON.parse(agent.worker) as Worker) : { kind: 'scripted' }, class: patch.class, hunk });
      }
    }
    return {
      path,
      version: ref ? (this.coord.versions(0, 100_000).find((v) => v.sha === sha)?.version ?? head.version) : head.version,
      content: content ?? '',
      lines: content === null ? 0 : content.split('\n').length - (content.endsWith('\n') ? 1 : 0),
      lastLanding: lastLanding ? { version: lastLanding.version, title: lastLanding.title, at: lastLanding.at } : null,
      writers,
      readers,
      notes: notes.sort((a, b) => a.hunk.oldStart - b.hunk.oldStart),
    };
  }

  private async overlayOf(agentId: string, workcell: string) {
    const wc = this.d.workcells.find((w) => w.name === workcell);
    if (!wc) return null;
    return wc.client.overlay(agentId).catch(() => null);
  }

  // ------------------------------------------------------------------ history

  landings(opts: { before?: number; limit?: number } = {}): Landing[] {
    return this.sql
      .all<LandingRow>(`SELECT * FROM landings WHERE version < ? ORDER BY version DESC LIMIT ?`, opts.before ?? Number.MAX_SAFE_INTEGER, Math.min(opts.limit ?? 50, 200))
      .map((r) => this.landingOf(r));
  }

  private landingOf(r: LandingRow): Landing {
    const by = JSON.parse(r.by) as { agentId?: string };
    const agent = by.agentId ? this.agentRow(by.agentId) : undefined;
    const swarm = agent ? one(this.sql.all<{ dispatched_by: string | null }>(`SELECT dispatched_by FROM swarms WHERE id = ?`, agent.swarm_id)) : undefined;
    return landingView(r, agent ? (JSON.parse(agent.worker) as Worker) : null, agent?.swarm_id ?? null, swarm?.dispatched_by ?? null);
  }

  // ------------------------------------------------------------------ policy and approvals

  private policyCache: RepoPolicy | null = null;

  policy(): RepoPolicy {
    this.policyCache ??= (() => {
      const row = one(this.sql.all<{ value: string }>(`SELECT value FROM settings WHERE key = 'policy'`));
      return row ? (JSON.parse(row.value) as RepoPolicy) : { protectedPaths: [] };
    })();
    return this.policyCache;
  }

  setPolicy(p: RepoPolicy): RepoPolicy {
    const globs = Array.isArray(p?.protectedPaths) ? p.protectedPaths : null;
    if (!globs || globs.length > 50 || globs.some((g) => typeof g !== 'string' || g.length > 200)) {
      throw new ApiError(400, 'bad-policy', 'protectedPaths must be a list of up to 50 path globs.');
    }
    const policy: RepoPolicy = { protectedPaths: [...new Set(globs.map((g) => g.trim()).filter(Boolean))] };
    this.sql.all(`INSERT OR REPLACE INTO settings (key, value) VALUES ('policy', ?)`, JSON.stringify(policy));
    this.policyCache = policy;
    return policy;
  }

  approvals(status?: Approval['status']): ApprovalView[] {
    return this.coord.approvals(status).map((a) => this.approvalView(a));
  }

  decide(id: string, approve: boolean, person: string | undefined, note?: string): ApprovalView {
    try {
      return this.approvalView(this.coord.decide(id, approve, this.actor(person), note));
    } catch (err) {
      if (err instanceof Error && /no approval|already/.test(err.message)) throw new ApiError(409, 'approval-decided', err.message);
      throw err;
    }
  }

  private approvalView(a: Approval): ApprovalView {
    const agent = this.agentRow(a.agentId);
    return { ...a, taskTitle: agent ? this.taskTitle(agent.task_id) : (a.taskId ?? a.agentId), swarmId: agent?.swarm_id ?? null };
  }

  /** Who is acting: the signed-in person, else the install's user. */
  private actor(person: string | undefined): string {
    return person ?? this.d.user ?? 'someone';
  }

  async landing(version: number): Promise<LandingDetail> {
    const lr = one(this.sql.all<LandingRow>(`SELECT * FROM landings WHERE version = ?`, version));
    if (!lr) throw notFound(`landing v${version}`);
    const record = this.coord.versions(version - 1, 1)[0];
    const classes = record?.version === version ? record.changes : {};
    const merged = new Map((JSON.parse(lr.files) as (FileStat & { merged?: string | null })[]).map((f) => [f.path, f.merged ?? null]));
    const patches: FilePatch[] = parsePatch(await this.d.git.diff(this.record.id, lr.sha), classes).map((p) => ({ ...p, merged: merged.get(p.path) ?? null }));
    // Cache real line counts and classes for the timeline.
    this.sql.all(`UPDATE landings SET files = ? WHERE version = ?`, JSON.stringify(patches.map((p) => ({ ...statOf(p), merged: p.merged }))), version);
    const fresh = one(this.sql.all<LandingRow>(`SELECT * FROM landings WHERE version = ?`, version))!;
    return {
      ...this.landingOf(fresh),
      patches,
      noticed: this.coord.noticesAt(version).filter((n) => n.severity !== 'ignore').map((n) => ({ agentId: n.agentId, severity: n.severity, path: n.path })),
    };
  }

  /** Fill in line counts for landings recorded with paths only (best effort, background). */
  private async enrichLanding(version: number): Promise<void> {
    try {
      await this.landing(version);
      const lr = one(this.sql.all<LandingRow>(`SELECT * FROM landings WHERE version = ?`, version));
      if (lr) this.broadcast({ type: 'main', main: { version: lr.version, sha: lr.sha, at: lr.at }, landing: this.landingOf(lr) });
    } catch (err) {
      this.log(`[${this.record.id}] landing v${version} stats: ${String(err)}`);
    }
  }

  // ------------------------------------------------------------------ tasks

  tasks(opts: { status?: TaskStatus; limit?: number } = {}): TaskV1[] {
    const rows = opts.status
      ? this.sql.all<TaskRow>(`SELECT * FROM tasks WHERE status = ? ORDER BY seq LIMIT ?`, opts.status, opts.limit ?? 1000)
      : this.sql.all<TaskRow>(`SELECT * FROM tasks ORDER BY seq LIMIT ?`, opts.limit ?? 1000);
    return rows.map((r) => taskView(r, this.record.id));
  }

  createTask(req: CreateTaskRequest): TaskV1 {
    const title = req.title?.trim();
    if (!title) throw new ApiError(400, 'bad-task', 'A task needs a title.');
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'task';
    let id = base;
    for (let n = 2; one(this.sql.all(`SELECT id FROM tasks WHERE id = ?`, id)); n++) id = `${base}-${n}`;
    const kind = req.kind ?? 'feature';
    const spec: Task = {
      id,
      kind: kind === 'change-order' ? 'change-order' : kind === 'contract' ? 'helper' : 'leaf',
      title,
      prompt: req.prompt?.trim() || title,
      tests: req.tests ?? [],
      dependsOn: req.dependsOn ?? [],
      contract: kind === 'contract',
      releaseAt: kind === 'change-order' ? 0 : undefined,
    };
    const seq = Number(one(this.sql.all<{ n: number }>(`SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM tasks`))?.n ?? 1);
    this.insertTask(spec, 'user', seq, this.now(), req.labels ?? []);
    return taskView(one(this.sql.all<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, id))!, this.record.id);
  }

  private insertTask(t: Task, source: 'user' | 'template', seq: number, at: number, labels: string[] = t.category ? [t.category] : []): void {
    this.sql.all(
      `INSERT INTO tasks (id, spec, kind, labels, status, swarm_id, source, created_at, seq) VALUES (?, ?, ?, ?, 'open', NULL, ?, ?, ?)`,
      t.id,
      JSON.stringify(t),
      kindOf(t),
      JSON.stringify(labels),
      source,
      at,
      seq,
    );
  }

  cancelTask(taskId: string): TaskV1 {
    const t = one(this.sql.all<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, taskId));
    if (!t) throw notFound(`task ${taskId}`);
    if (t.status !== 'open') throw new ApiError(409, 'not-open', `task ${taskId} is ${t.status}`);
    this.sql.all(`UPDATE tasks SET status = 'cancelled' WHERE id = ?`, taskId);
    return taskView({ ...t, status: 'cancelled' }, this.record.id);
  }

  // ------------------------------------------------------------------ swarms

  swarms(): Swarm[] {
    return this.sql.all<SwarmRow>(`SELECT * FROM swarms ORDER BY created_at DESC`).map((s) => this.swarmOf(s));
  }

  swarm(id: string): Swarm {
    return this.swarmOf(this.swarmRow(id));
  }

  private swarmRow(id: string): SwarmRow {
    const s = one(this.sql.all<SwarmRow>(`SELECT * FROM swarms WHERE id = ?`, id));
    if (!s) throw notFound(`swarm ${id}`);
    return s;
  }

  private swarmOf(s: SwarmRow): Swarm {
    if (s.final_counts) {
      // A finished swarm keeps the counts it ended with (its tasks may be dispatched again later).
      const final = JSON.parse(s.final_counts) as { counts: SwarmCounts; cost: { usd: number; inputTokens: number; outputTokens: number; known: boolean } };
      return swarmView(s, this.record.id, final.counts, final.cost);
    }
    return swarmView(s, this.record.id, ...this.liveCounts(s));
  }

  private liveCounts(s: SwarmRow): [SwarmCounts, { usd: number; inputTokens: number; outputTokens: number; known: boolean }] {
    const ids = JSON.parse(s.task_ids) as string[];
    const byStatus = new Map<string, number>();
    for (const r of this.sql.all<{ status: string; n: number }>(`SELECT status, COUNT(*) AS n FROM tasks WHERE swarm_id = ? GROUP BY status`, s.id)) byStatus.set(r.status, r.n);
    const agentStates = new Map<string, number>();
    for (const r of this.sql.all<{ state: string; n: number }>(`SELECT state, COUNT(*) AS n FROM agents WHERE swarm_id = ? GROUP BY state`, s.id)) agentStates.set(r.state, r.n);
    const gaveUp = agentStates.get('gave-up') ?? 0;
    const counts: SwarmCounts = {
      total: ids.length,
      queued: byStatus.get('queued') ?? 0,
      running: byStatus.get('running') ?? 0,
      landed: byStatus.get('landed') ?? 0,
      guarded: agentStates.get('guarded') ?? 0,
      gaveUp,
      failed: Math.max(0, (byStatus.get('failed') ?? 0) - gaveUp),
    };
    const cost = one(
      this.sql.all<{ usd: number | null; input: number; output: number; unknown: number }>(
        `SELECT SUM(cost_usd) AS usd, SUM(input_tokens) AS input, SUM(output_tokens) AS output,
                SUM(CASE WHEN cost_usd IS NULL AND worker LIKE '%"model"%' AND tool_calls > 0 THEN 1 ELSE 0 END) AS unknown
         FROM agents WHERE swarm_id = ?`,
        s.id,
      ),
    );
    return [counts, { usd: cost?.usd ?? 0, inputTokens: cost?.input ?? 0, outputTokens: cost?.output ?? 0, known: (cost?.unknown ?? 0) === 0 }];
  }

  private modelProviders(req: DispatchRequest): ProviderId[] {
    return [...new Set(req.rules.flatMap((r) => (r.worker.kind === 'model' ? [r.worker.provider] : [])))];
  }

  async estimate(req: DispatchRequest): Promise<DispatchEstimate> {
    const tasks = this.resolveTasks(req, false);
    const missingKeys = await this.d.keys.missing(this.modelProviders(req));
    // From this repo's history: average cost per finished model agent; scripted agents cost nothing.
    const hist = one(this.sql.all<{ usd: number | null; secs: number | null }>(`SELECT AVG(cost_usd) AS usd, AVG((finished_at - started_at) / 1000.0) AS secs FROM agents WHERE finished_at IS NOT NULL`));
    const perTask = req.rules.every((r) => r.worker.kind === 'scripted') ? 0 : (hist?.usd ?? 0.25);
    const minutesPerTask = (hist?.secs ?? 180) / 60;
    return {
      tasks: tasks.length,
      usdLow: Math.round(perTask * 0.6 * tasks.length * 100) / 100,
      usdHigh: Math.round(perTask * 1.6 * tasks.length * 100) / 100,
      minutes: Math.ceil((tasks.length / Math.max(1, req.concurrency)) * minutesPerTask),
      missingKeys,
    };
  }

  /** The tasks to run: the requested ones, plus any not-yet-landed dependencies they need. */
  private resolveTasks(req: DispatchRequest, create: boolean): Task[] {
    const created = create ? (req.newTasks ?? []).map((t) => this.createTask(t).id) : [];
    const wanted = new Set([...(req.taskIds ?? []), ...created]);
    const rows = new Map(this.sql.all<TaskRow>(`SELECT * FROM tasks`).map((r) => [r.id, r]));
    const selected = new Map<string, Task>();
    const visit = (id: string) => {
      if (selected.has(id)) return;
      const r = rows.get(id);
      if (!r) throw new ApiError(400, 'unknown-task', `no task ${id}`);
      if (r.status === 'landed') return;
      if (r.status === 'queued' || r.status === 'running') throw new ApiError(409, 'busy', `task ${id} is already ${r.status}`);
      const t = JSON.parse(r.spec) as Task;
      selected.set(id, t);
      for (const dep of t.dependsOn) visit(dep);
    };
    for (const id of wanted) visit(id);
    const landed = new Set([...rows.values()].filter((r) => r.status === 'landed').map((r) => r.id));
    return [...selected.values()].map((t) => ({ ...t, dependsOn: t.dependsOn.filter((d) => !landed.has(d)) }));
  }

  async dispatch(req: DispatchRequest, person?: string): Promise<Swarm> {
    if (!Number.isInteger(req.concurrency) || req.concurrency < 1 || req.concurrency > 100) throw new ApiError(400, 'bad-concurrency', 'Concurrency must be 1 to 100 agents.');
    if (!Array.isArray(req.rules) || req.rules.length === 0) throw new ApiError(400, 'no-rules', 'Choose at least one worker.');
    const template = this.d.template;
    for (const r of req.rules) {
      if (r.worker.kind === 'scripted' && !template?.solution) throw new ApiError(400, 'no-solutions', 'Replay workers only run on template repositories that ship reference solutions.');
    }
    const missing = await this.d.keys.missing(this.modelProviders(req));
    if (missing[0]) throw new ApiError(400, 'missing-key', `Add a ${PROVIDERS[missing[0]].label} key first.`);
    const tasks = this.resolveTasks(req, true);
    if (tasks.length === 0) throw new ApiError(400, 'no-tasks', 'Nothing to dispatch: pick at least one open task.');
    const id = `s${this.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const budget: Budget = { maxUsd: req.budget?.maxUsd ?? null, maxMinutes: req.budget?.maxMinutes ?? null };
    this.sql.transaction(() => {
      this.sql.all(
        `INSERT INTO swarms (id, name, status, concurrency, rules, budget, task_ids, created_at, dispatched_by) VALUES (?, ?, 'running', ?, ?, ?, ?, ?, ?)`,
        id,
        req.name?.trim() || `Swarm of ${tasks.length} task${tasks.length === 1 ? '' : 's'}`,
        req.concurrency,
        JSON.stringify(req.rules),
        JSON.stringify(budget),
        JSON.stringify(tasks.map((t) => t.id)),
        this.now(),
        this.actor(person),
      );
      for (const t of tasks) this.sql.all(`UPDATE tasks SET status = 'queued', swarm_id = ? WHERE id = ?`, id, t.id);
    });
    const run = this.runner.start(this.swarmDeps(id, tasks));
    this.runs.set(id, run);
    void run.done.finally(() => this.runs.delete(id));
    return this.swarm(id);
  }

  /**
   * Everything a runner needs for one swarm, rebuilt from its row (durable runners call this
   * again after the service restarts, since callbacks do not survive).
   */
  swarmDeps(id: string, tasks?: Task[]): SwarmRunDeps {
    const s = this.swarmRow(id);
    const r = this.record;
    const template = this.d.template;
    // Rebuilt like dispatch resolved them: dependencies outside the swarm had already landed.
    const ids = new Set(JSON.parse(s.task_ids) as string[]);
    const runTasks =
      tasks ??
      [...ids].flatMap((t) => {
        const row = one(this.sql.all<{ spec: string }>(`SELECT spec FROM tasks WHERE id = ?`, t));
        if (!row) return [];
        const spec = JSON.parse(row.spec) as Task;
        return [{ ...spec, dependsOn: spec.dependsOn.filter((d) => ids.has(d)) }];
      });
    return {
      swarmId: id,
      tasks: runTasks,
      concurrency: s.concurrency,
      rules: JSON.parse(s.rules) as SwarmRunDeps['rules'],
      coord: this.coord,
      remote: r.remote,
      workcells: this.d.workcells,
      project: r.description ? `${r.name} (${r.description})` : r.name,
      provider: (w) => this.d.keys.provider(w.provider),
      solution: (taskId, naive) => template?.solution?.(taskId, naive),
      thinkMs: this.d.thinkMs ?? 900,
      register: (a) => {
        const now = this.now();
        this.sql.all(
          `INSERT OR IGNORE INTO agents (id, swarm_id, task_id, worker, workcell, state, detail, started_at, updated_at) VALUES (?, ?, ?, ?, ?, 'queued', 'starting', ?, ?)`,
          a.id,
          id,
          a.taskId,
          JSON.stringify(a.worker),
          a.workcell,
          now,
          now,
        );
        this.pushAgent(a.id);
      },
      openSeat: (agentId) => this.openSeat(agentId),
      capReason: () => this.capReason(id),
      setStatus: (status, reason) => this.setSwarmStatus(id, status, reason),
      log: (line) => this.log(`[${id}] ${line}`),
    };
  }

  private capReason(swarmId: string): string | null {
    const s = this.swarm(swarmId);
    if (s.budget.maxUsd !== null && s.cost.usd >= s.budget.maxUsd) return `budget cap reached: $${s.cost.usd.toFixed(2)} of $${s.budget.maxUsd.toFixed(2)}`;
    if (s.budget.maxMinutes !== null && this.now() - s.createdAt >= s.budget.maxMinutes * 60_000) return `time cap reached: ${s.budget.maxMinutes} min`;
    return null;
  }

  private setSwarmStatus(id: string, status: SwarmStatus, reason: string | null): void {
    const final = status === 'finished' || status === 'stopped';
    this.sql.all(`UPDATE swarms SET status = ?, reason = ?, finished_at = ? WHERE id = ?`, status, reason, final ? this.now() : null, id);
    if (final) {
      // Tasks the swarm never started go back to the open list; its counts are kept as they ended.
      this.sql.all(`UPDATE tasks SET status = 'failed' WHERE swarm_id = ? AND status = 'running'`, id);
      const [counts, cost] = this.liveCounts(this.swarmRow(id));
      this.sql.all(`UPDATE swarms SET final_counts = ? WHERE id = ?`, JSON.stringify({ counts: { ...counts, queued: 0 }, cost }), id);
      this.sql.all(`UPDATE tasks SET status = 'open', swarm_id = NULL WHERE swarm_id = ? AND status = 'queued'`, id);
    }
    this.broadcast({ type: 'swarm', swarm: this.swarm(id) });
  }

  private control(id: string): SwarmHandle {
    this.swarmRow(id);
    const run = this.runs.get(id) ?? this.runner.attach?.(id) ?? undefined;
    if (!run) throw new ApiError(409, 'not-running', `swarm ${id} is not running`);
    return run;
  }

  pause(id: string): Swarm {
    this.control(id).pause();
    return this.swarm(id);
  }

  resume(id: string): Swarm {
    const handle = this.control(id);
    const reason = this.capReason(id);
    if (reason) throw new ApiError(409, 'at-cap', `${reason}. Raise the cap to resume.`);
    handle.resume();
    return this.swarm(id);
  }

  stop(id: string): Swarm {
    this.control(id).stop();
    return this.swarm(id);
  }

  setBudget(id: string, budget: Partial<Budget>): Swarm {
    const s = this.swarmRow(id);
    const next = { ...(JSON.parse(s.budget) as Budget), ...budget };
    this.sql.all(`UPDATE swarms SET budget = ? WHERE id = ?`, JSON.stringify(next), id);
    const view = this.swarm(id);
    this.broadcast({ type: 'swarm', swarm: view });
    return view;
  }

  // ------------------------------------------------------------------ agents

  agents(opts: { swarmId?: string; active?: boolean } = {}): AgentSummary[] {
    const rows = this.sql.all<AgentRow>(
      `SELECT * FROM agents WHERE 1 = 1 ${opts.swarmId ? 'AND swarm_id = ?' : ''} ${opts.active ? "AND state NOT IN ('landed', 'gave-up', 'stopped', 'error')" : ''} ORDER BY started_at DESC LIMIT 500`,
      ...(opts.swarmId ? [opts.swarmId] : []),
    );
    return rows.map((r) => this.agentSummary(r));
  }

  private agentRow(id: string): AgentRow | undefined {
    return one(this.sql.all<AgentRow>(`SELECT * FROM agents WHERE id = ?`, id));
  }

  private taskTitle(taskId: string): string {
    const t = one(this.sql.all<{ spec: string }>(`SELECT spec FROM tasks WHERE id = ?`, taskId));
    return t ? (JSON.parse(t.spec) as Task).title : taskId;
  }

  private agentSummary(r: AgentRow): AgentSummary {
    let writes: FileStat[] = [];
    let reads = 0;
    try {
      const ov = this.coord.overlay(r.id);
      writes = ov.writeSet.map((p) => ({ path: p, class: 'body' as ChangeClass, added: 0, removed: 0, status: 'modified' as const }));
      reads = ov.readSet.length;
    } catch {
      // not registered yet
    }
    if (r.landed_version !== null) {
      const lr = one(this.sql.all<LandingRow>(`SELECT * FROM landings WHERE version = ?`, r.landed_version));
      if (lr) writes = JSON.parse(lr.files) as FileStat[];
    }
    return agentView(r, this.record.id, this.taskTitle(r.task_id), writes, reads);
  }

  async agent(id: string): Promise<AgentDetail> {
    const r = this.agentRow(id);
    if (!r) throw notFound(`agent ${id}`);
    const head = this.coord.head();
    const summary = this.agentSummary(r);
    const task = one(this.sql.all<{ spec: string }>(`SELECT spec FROM tasks WHERE id = ?`, r.task_id));
    const entries = this.sql
      .all<{ seq: number; kind: string; body: string; at: number }>(`SELECT seq, kind, body, at FROM agent_log WHERE agent_id = ? ORDER BY seq`, id)
      .map((l) => ({ ...l, body: JSON.parse(l.body) as Record<string, unknown> }));

    let readSet: AgentDetail['readSet'] = [];
    try {
      const ov = this.coord.overlay(id);
      const delta = this.coord.deltaFor(ov.pin, head.version, ov.readSet);
      readSet = ov.readSet.map((p) => ({ path: p, changedSincePin: delta[p] ?? null }));
    } catch {
      // never registered
    }

    const noticeList = this.coord.noticesFor(id).map((n) => {
      const after = entries.find((e) => e.at >= n.at && (e.kind === 'tests' || (e.kind === 'step' && ['write_file', 'edit_file', 'replace_in_files', 'revert_file'].includes(String(e.body.tool)))));
      const outcome = !after
        ? null
        : after.kind === 'tests'
          ? after.body.ok
            ? `re-ran tests: ${String(after.body.passed)} passing`
            : `re-ran tests: ${String(after.body.failed)} failing`
          : `changed ${String(after.body.summary).split(' · ')[0]}`;
      return { ...n, outcome };
    });

    let patches: FilePatch[] = [];
    if (r.landed_version !== null) {
      patches = (await this.landing(r.landed_version)).patches;
    } else if (!FINAL_AGENT_STATES.has(r.state as AgentState)) {
      const overlay = await this.overlayOf(id, r.workcell);
      if (overlay) {
        patches = await Promise.all(
          overlay.changes.map(async (c) => {
            const current = await this.d.git.file(this.record.id, head.sha, c.path);
            // A pin the store can't serve degrades to the plain diff against main.
            const pinned = await this.d.git.file(this.record.id, overlay.pinSha, c.path).catch(() => current);
            return overlayPatch(c.path, pinned, current, c.content, (overlay.classes?.[c.path] as ChangeClass | undefined) ?? 'body');
          }),
        );
      }
    } else {
      // Finished without landing: its last published overlay snapshot, against its pin.
      patches = parsePatch(await this.d.git.diff(this.record.id, `overlay/${id}`).catch(() => ''));
    }

    return {
      ...summary,
      writes: patches.length > 0 ? patches.map(statOf) : summary.writes,
      prompt: task ? (JSON.parse(task.spec) as Task).prompt : '',
      readSet,
      noticeList,
      guardList: entries.filter((e) => e.kind === 'guard').map((e) => ({ at: e.at, tests: e.body.tests as string[], failures: [] })),
      checkpoints: entries.filter((e) => e.kind === 'checkpoint').map((e) => ({ from: e.body.from as number, to: e.body.to as number, notices: e.body.notices as number, at: e.at })),
      testRuns: entries.filter((e) => e.kind === 'tests').map((e) => ({ at: e.at, passed: e.body.passed as number, failed: e.body.failed as number, ok: e.body.ok as boolean })),
      steps: entries.filter((e) => e.kind === 'step').map((e) => ({ seq: e.seq, tool: String(e.body.tool), summary: String(e.body.summary), ok: e.body.ok === true, at: e.at })),
      patches,
    };
  }

  stopAgent(id: string): AgentSummary {
    const r = this.agentRow(id);
    if (!r) throw notFound(`agent ${id}`);
    const run = this.runs.get(r.swarm_id) ?? this.runner.attach?.(r.swarm_id);
    if (!run || !run.stopAgent(id)) throw new ApiError(409, 'not-running', `agent ${id} is not running`);
    return this.agentSummary(r);
  }

  // ------------------------------------------------------------------ external agents (seats)

  /** An external agent's session is ready: a client may claim it. */
  openSeat(agentId: string): void {
    this.sql.all(`UPDATE agents SET seat = 'open' WHERE id = ? AND seat IS NULL`, agentId);
    this.pushAgent(agentId);
  }

  /** Give `person` the oldest open seat (in `swarmId`, if given): they now drive that agent. */
  async claim(person: string | undefined, swarmId?: string): Promise<ClaimedTask> {
    const who = this.actor(person);
    const row = one(
      this.sql.all<AgentRow>(
        `UPDATE agents SET seat = 'claimed', claimed_by = ?, updated_at = ? WHERE id = (SELECT id FROM agents WHERE seat = 'open'${swarmId ? ' AND swarm_id = ?' : ''} ORDER BY started_at LIMIT 1) AND seat = 'open' RETURNING *`,
        who,
        this.now(),
        ...(swarmId ? [swarmId] : []),
      ),
    );
    if (!row) throw new ApiError(404, 'no-open-task', swarmId ? `No task in swarm ${swarmId} is waiting for an agent.` : 'No task is waiting for an external agent. Dispatch a swarm with the Claude Code worker first.');
    const worker = JSON.parse(row.worker) as Worker;
    this.coord.emit({ type: 'agent.state', agentId: row.id, state: 'working', detail: `claimed by ${who}${worker.kind === 'external' ? ` (${worker.name})` : ''}`, at: this.now() });
    await this.control(row.swarm_id).claimed(row.id);
    const spec = JSON.parse(one(this.sql.all<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, row.task_id))!.spec) as Task;
    const r = this.record;
    return {
      agentId: row.id,
      swarmId: row.swarm_id,
      repo: `${r.owner}/${r.name}`,
      task: { id: spec.id, title: spec.title, prompt: spec.prompt, tests: spec.tests },
      brief: agentBrief({ strategy: new LiveMainStrategy() }, r.description ? `${r.name} (${r.description})` : r.name),
    };
  }

  /** One tool call by the agent's claimer. */
  async agentTool(agentId: string, person: string | undefined, name: string, input: Record<string, unknown>): Promise<AgentToolResult> {
    const row = this.agentRow(agentId);
    if (!row) throw notFound(`agent ${agentId}`);
    if (row.seat !== 'claimed' || row.claimed_by !== this.actor(person)) throw new ApiError(403, 'not-your-agent', `Agent ${agentId} is not claimed by you.`);
    if (name !== 'give_up' && !AGENT_TOOLS.some((t) => t.name === name)) throw new ApiError(400, 'unknown-tool', `No tool ${name}.`);
    const out = await this.control(row.swarm_id).tool(agentId, name, input && typeof input === 'object' ? input : {});
    return { text: out.text, isError: out.isError, landed: !!out.landed };
  }

  // ------------------------------------------------------------------ events

  /** Live updates for this repo. Returns an unsubscribe function. */
  subscribe(fn: (e: RepoEvent) => void): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private broadcast(e: RepoEvent): void {
    for (const fn of this.subscribers) {
      try {
        fn(e);
      } catch {
        // a broken subscriber must not affect the others
      }
    }
  }

  private pushAgent(agentId: string): void {
    if (this.subscribers.size === 0) return;
    const r = this.agentRow(agentId);
    if (r) this.broadcast({ type: 'agent', agent: this.agentSummary(r) });
  }

  private onEvent(event: RunEvent): void {
    const out = this.projector.apply(event);
    if (out.agentId) this.pushAgent(out.agentId);
    if (out.notice) this.broadcast({ type: 'notice', notice: out.notice });
    if (out.ci) this.broadcast({ type: 'ci', ...out.ci });
    if (out.approval) this.broadcast({ type: 'approval', approval: this.approvalView(out.approval) });
    if (out.landing !== undefined) void this.enrichLanding(out.landing);
    if ((event.type === 'task.finished' || event.type === 'task.started') && this.subscribers.size > 0) {
      const a = this.agentRow(event.agentId);
      if (a) this.broadcast({ type: 'swarm', swarm: this.swarm(a.swarm_id) });
    }
  }

  /** Stop every swarm and the CI loop (shutdown, tests). */
  async close(): Promise<void> {
    for (const run of this.runs.values()) run.stop();
    await Promise.allSettled([...this.runs.values()].map((r) => r.done));
    await this.ci.stop();
  }
}
