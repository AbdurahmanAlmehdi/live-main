import type { WorkcellNotice } from '@livemain/protocol';
import { renderNotices, type AgentSession, type LandOutcome, type Strategy, type ToolOutcome } from '../session.js';

/** How long one submit waits for an approval by default (within an agent's alarm slice), and how often it checks. */
const APPROVAL_WAIT_MS = 4 * 60_000;
const APPROVAL_POLL_MS = 3_000;

/**
 * Live Main: the agent works in a FUSE overlay on a pinned version of main. The view
 * advances at checkpoints, and the filesystem reports what moved under the agent.
 * Landing is a promotion through the coordinator (no branches, no rebases).
 */
export class LiveMainStrategy implements Strategy {
  readonly name = 'live-main' as const;
  readonly workspaceKind = 'livefs' as const;

  /** `approvalWaitMs`: how long one submit waits for an approval (short for external agents, whose tool calls time out). */
  constructor(private readonly opts: { approvalWaitMs?: number } = {}) {}

  async setup(s: AgentSession): Promise<void> {
    const reg = await s.coordinator.register({ agentId: s.agentId, taskId: s.task.id, strategy: this.name, workcell: s.workcellName });
    await s.workcell.createWorkspace({ id: s.workspaceId, kind: 'livefs', remote: s.remote, sha: reg.sha });
    s.pin = reg.pin;
  }

  async beforeTool(s: AgentSession, tool: string): Promise<string[]> {
    // Checkpoint triggers: before every test run, every N tool calls, and right after an interrupt.
    const due = tool === 'run_tests' || s.interruptPending || s.stats.toolCalls % s.checkpointEvery === 0;
    if (!due || tool === 'checkpoint' || tool === 'submit') return [];
    const note = await this.checkpoint(s);
    return note ? [note] : [];
  }

  /** Advance the view to the latest main and classify what moved. Returns rendered notices, if any. */
  async checkpoint(s: AgentSession): Promise<string | null> {
    s.clearInterrupt();
    const begin = await s.coordinator.checkpointBegin(s.agentId);
    if (begin.to === begin.from) return null;
    const resume = s.currentState;
    await s.setState('checkpointing', `advancing to main v${begin.to}`);
    const result = await s.workcell.checkpoint(s.workspaceId, begin.toSha);
    await s.coordinator.checkpointCommit({
      agentId: s.agentId,
      to: begin.to,
      readSet: result.readSet,
      writeSet: result.writeSet,
      notices: result.notices,
    });
    s.pin = begin.to;
    s.stats.checkpoints++;
    // Notices the coordinator pushed for versions we just absorbed are now covered by this report.
    await s.skipNotices();
    const interrupt = result.notices.find((n) => n.severity === 'interrupt');
    if (interrupt) await s.noteInterrupt(`${interrupt.path} changed on main (v${begin.to}): ${interrupt.reason}`);
    else await s.setState(resume === 'ready' || resume === 'guarded' ? 'working' : (resume ?? 'working'), `at main v${begin.to}`);
    s.clearInterrupt(); // the checkpoint itself is the response to the interrupt trigger
    if (affectsWork(result.notices)) {
      s.bumpView();
      if (result.notices.some((n) => n.mergeResult === 'conflict')) s.stats.conflicts++;
    }
    await this.snapshot(s, `checkpoint to main v${begin.to}`);
    const relevant = result.notices.filter((n) => n.severity !== 'ignore' || n.mergeResult !== null);
    if (relevant.length === 0) return null;
    return `${renderNotices(relevant.map((n) => ({ ...n, mergeResult: n.mergeResult ?? null })))}\n(view advanced to main v${begin.to})`;
  }

  async afterTests(s: AgentSession): Promise<void> {
    // Publish the read set the test run produced, so landings elsewhere can notify us early.
    const ov = await s.workcell.overlay(s.workspaceId);
    await s.coordinator.reportSets(s.agentId, ov.readSet, ov.writeSet);
    await this.snapshot(s, 'tests green');
  }

  /** Best effort: publish the overlay as a cloneable commit (never blocks the agent). */
  private async snapshot(s: AgentSession, why: string): Promise<void> {
    if (!s.snapshotTarget) return;
    try {
      await s.workcell.snapshot(s.workspaceId, s.snapshotTarget.remote, s.snapshotTarget.ref, `${s.task.id}: ${why}`);
    } catch {
      // snapshots are an observability feature; promotion does not depend on them
    }
  }

  requiresGreenForSubmit(): boolean {
    return true;
  }

  async land(s: AgentSession, message: string): Promise<LandOutcome> {
    const ov = await s.workcell.overlay(s.workspaceId);
    if (ov.changes.length === 0) return { landed: false, message: 'nothing to submit: your overlay has no changes' };
    const req = {
      agentId: s.agentId,
      pin: s.pin,
      readSet: ov.readSet,
      writeSet: ov.writeSet,
      changes: ov.changes,
      testsRun: s.greenFiles,
      classes: ov.classes,
      message: `${s.task.id}: ${message}`.slice(0, 200),
      priority: s.task.kind === 'change-order',
    };
    let res = await s.coordinator.promote(req);
    // Protected paths: wait (a while) for a person's decision, re-submitting to pick it up.
    for (let waiting = '', until = Date.now() + (this.opts.approvalWaitMs ?? APPROVAL_WAIT_MS); res.status === 'awaiting-approval' && Date.now() < until; ) {
      const detail = `waiting for a person to approve changes to ${res.paths.join(', ')}`;
      if (detail !== waiting) await s.setState('ready', (waiting = detail));
      await s.pause(APPROVAL_POLL_MS);
      res = await s.coordinator.promote(req);
    }
    switch (res.status) {
      case 'awaiting-approval':
        return {
          landed: false,
          attempted: false,
          message: `NOT LANDED YET: your change touches protected paths (${res.paths.join(', ')}), which need a person's approval. It has been requested; submit again later (nothing else to do).`,
        };
      case 'landed': {
        const merged = res.merged.length > 0 ? ` (auto-merged: ${res.merged.map((m) => `${m.path} via ${m.method}`).join(', ')})` : '';
        return {
          landed: true,
          message: `LANDED as main v${res.version} (${res.sha.slice(0, 10)})${merged}. Task complete.`,
          state: { state: 'landed', detail: `landed as main v${res.version}` },
        };
      }
      case 'stale': {
        s.stats.staleRejections++;
        const why = res.reasons.map((r) => `${r.path} (${r.why}, ${r.class})`).join(', ');
        const report = await this.checkpoint(s);
        s.bumpView();
        return {
          landed: false,
          invalidateTests: true,
          message: `NOT LANDED: main moved under files your change depends on: ${why}. Your view was advanced to main v${s.pin}.\n${
            report ?? ''
          }\nReview the changes, adapt if needed, re-run the tests, then submit again.`,
          state: s.currentState === 'interrupted' ? undefined : { state: 'working', detail: `main moved under ${res.reasons.map((r) => r.path).join(', ')}; re-checking` },
        };
      }
      case 'impact-failed': {
        s.stats.impactRejections++;
        const failures = res.failures
          .map((f) => `✗ ${f.file}\n${f.failures.slice(0, 5).map((x) => `    ${x.name}: ${x.message.split('\n')[0]}`).join('\n')}`)
          .join('\n');
        return {
          landed: false,
          invalidateTests: true,
          message: `NOT LANDED: your change breaks tests of code already on main (they read files you changed):\n${failures}\nKeep existing behavior working (e.g. make the new behavior opt-in), re-run those tests too, then submit again.`,
          state: { state: 'guarded', detail: `landing stopped: it would break ${res.failures.filter((f) => !f.ok).map((f) => f.file.replace(/^.*\//, '').replace(/\.test\.ts$/, '')).join(', ')}` },
        };
      }
      case 'rejected':
        return { landed: false, message: `NOT LANDED: ${res.reason}` };
    }
  }

  describe(): string {
    return [
      'Version control: Live Main. Your workspace is a live overlay on the shared main branch: you see main plus your own edits.',
      'There are no branches, rebases, or merges for you to do. When main changes under files you read or edited, you get a "[livemain]" notice in a tool result, and your view advances to the latest main (edits to the same file are merged automatically when possible).',
      'Take INTERRUPT notices seriously: a contract you depend on changed. REVIEW notices: check whether your code is still correct.',
      'When your task tests pass, call submit. If main moved in a way that affects you, submit tells you what changed; adapt, re-run tests, and submit again.',
    ].join('\n');
  }

  extraTools() {
    return [
      {
        name: 'checkpoint',
        description: 'Advance your view to the latest main now and report what changed under files you read or edited. Happens automatically before tests and periodically.',
        input_schema: { type: 'object', properties: {}, additionalProperties: false },
      },
    ];
  }

  async callExtra(s: AgentSession, name: string): Promise<ToolOutcome> {
    if (name !== 'checkpoint') return { text: `unknown tool ${name}`, isError: true };
    const note = await this.checkpoint(s);
    return { text: note ?? `already at latest main (v${s.pin})`, isError: false };
  }
}

/** A checkpoint invalidates earlier green tests only if something the agent depends on changed. */
function affectsWork(notices: WorkcellNotice[]): boolean {
  return notices.some((n) => n.severity !== 'ignore' || n.mergeResult === 'conflict');
}
