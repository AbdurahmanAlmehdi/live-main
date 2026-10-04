import type { SqlStore } from '@livemain/core';
import type { Approval, RunEvent } from '@livemain/protocol';

/** What changed in the read models, so the service can push fresh views to subscribers. */
export interface Projected {
  agentId?: string;
  landing?: number;
  notice?: Extract<RunEvent, { type: 'notice' }>['notice'];
  ci?: { version: number; passed: number; failed: number };
  approval?: Approval;
}

/**
 * Folds one repo's coordinator events into that repo's read tables (agents, agent_log,
 * landings). Synchronous and idempotent per event; landing file stats are filled in later
 * by the repo service from git (they need a diff).
 */
export class Projector {
  constructor(private readonly sql: SqlStore) {}

  apply(event: RunEvent): Projected {
    const sql = this.sql;
    switch (event.type) {
      case 'agent.state':
        sql.all(`UPDATE agents SET state = ?, detail = ?, updated_at = ? WHERE id = ?`, event.state, event.detail, event.at, event.agentId);
        return { agentId: event.agentId };
      case 'agent.step':
        sql.all(`UPDATE agents SET tool_calls = tool_calls + 1, updated_at = ? WHERE id = ?`, event.at, event.agentId);
        this.log(event.agentId, 'step', { tool: event.tool, summary: event.summary, ok: event.ok }, event.at);
        return { agentId: event.agentId };
      case 'agent.tests':
        this.log(event.agentId, 'tests', { passed: event.passed, failed: event.failed, ok: event.ok }, event.at);
        return {};
      case 'agent.cost':
        sql.all(`UPDATE agents SET cost_usd = ?, input_tokens = ?, output_tokens = ?, updated_at = ? WHERE id = ?`, event.usd, event.inputTokens, event.outputTokens, event.at, event.agentId);
        return { agentId: event.agentId };
      case 'checkpoint':
        sql.all(`UPDATE agents SET pin = ?, updated_at = ? WHERE id = ?`, event.to, event.at, event.agentId);
        this.log(event.agentId, 'checkpoint', { from: event.from, to: event.to, notices: event.notices }, event.at);
        return { agentId: event.agentId };
      case 'notice': {
        const n = event.notice;
        if (n.severity === 'interrupt') sql.all(`UPDATE agents SET interrupts = interrupts + 1 WHERE id = ?`, n.agentId);
        if (n.severity === 'review') sql.all(`UPDATE agents SET reviews = reviews + 1 WHERE id = ?`, n.agentId);
        return { agentId: n.agentId, notice: n };
      }
      case 'promotion.rejected':
        if (event.reason === 'impact-failed') {
          sql.all(`UPDATE agents SET guards = guards + 1 WHERE id = ?`, event.agentId);
          this.log(event.agentId, 'guard', { tests: event.paths }, event.at);
        }
        return { agentId: event.agentId };
      case 'task.started':
        sql.all(`UPDATE tasks SET status = 'running' WHERE id = ?`, event.taskId);
        return {};
      case 'task.finished':
        sql.all(`UPDATE agents SET finished_at = ? WHERE id = ?`, event.at, event.agentId);
        sql.all(`UPDATE tasks SET status = ? WHERE id = ? AND status = 'running'`, event.outcome === 'landed' ? 'landed' : 'failed', event.taskId);
        return { agentId: event.agentId };
      case 'landed': {
        const agent = event.agentId === 'seed' || event.agentId === 'external' || event.pushedBy ? null : event.agentId;
        const task = agent && event.taskId ? sql.all<{ spec: string }>(`SELECT spec FROM tasks WHERE id = ?`, event.taskId)[0] : undefined;
        const title = task ? (JSON.parse(task.spec) as { title: string }).title : event.agentId === 'seed' ? 'Initial commit' : (event.title ?? event.taskId ?? 'Push to main');
        const by = agent ? { kind: 'agent', agentId: agent, taskId: event.taskId } : event.agentId === 'seed' ? { kind: 'seed' } : { kind: 'human', name: event.pushedBy ?? 'someone', via: 'push' };
        const co = event.changeOrder || event.taskId?.startsWith('co-') ? 1 : 0;
        sql.all(
          `INSERT OR IGNORE INTO landings (version, sha, at, title, by, change_order, files, merged, impact) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          event.version,
          event.sha,
          event.at,
          title,
          JSON.stringify(by),
          co,
          JSON.stringify(event.paths.map((p) => ({ path: p, class: 'body', added: 0, removed: 0, status: 'modified', merged: event.merges?.find((m) => m.path === p)?.method ?? null }))),
          event.merged,
          JSON.stringify(event.impactTests ?? []),
        );
        if (event.approval) sql.all(`UPDATE landings SET approval = ? WHERE version = ?`, JSON.stringify({ by: event.approval.by, paths: event.approval.paths }), event.version);
        if (agent) sql.all(`UPDATE agents SET landed_version = ?, state = 'landed', updated_at = ? WHERE id = ?`, event.version, event.at, agent);
        return { landing: event.version, agentId: agent ?? undefined };
      }
      case 'approval':
        if (event.approval.status === 'pending') this.log(event.approval.agentId, 'approval', { paths: event.approval.paths }, event.at);
        return { approval: event.approval, agentId: event.approval.agentId };
      case 'ci':
        sql.all(`UPDATE landings SET ci = ? WHERE version = ?`, JSON.stringify({ passed: event.passed, failed: event.failed }), event.version);
        return { ci: { version: event.version, passed: event.passed, failed: event.failed } };
      default:
        return {};
    }
  }

  private log(agentId: string, kind: string, body: unknown, at: number): void {
    this.sql.all(
      `INSERT INTO agent_log (agent_id, seq, kind, body, at) VALUES (?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM agent_log WHERE agent_id = ?), ?, ?, ?)`,
      agentId,
      agentId,
      kind,
      JSON.stringify(body),
      at,
    );
  }
}
