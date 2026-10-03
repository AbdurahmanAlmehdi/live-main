import type { ChangeClass } from '@livemain/protocol';
import type { AgentSession, LandOutcome, Strategy } from '../session.js';

interface GitState {
  rebasing?: boolean;
  conflictFiles?: string[];
  submittedOnce?: boolean;
}

const MAIN = 'main';
const MAIN_REF = 'refs/heads/main';

/** Shared plumbing for the branch-based baselines: a plain git clone on a feature branch. */
abstract class GitBaseline implements Strategy {
  abstract readonly name: 'pr-flow' | 'push-to-branch';
  readonly workspaceKind = 'clone' as const;

  async setup(s: AgentSession): Promise<void> {
    const reg = await s.coordinator.register({ agentId: s.agentId, taskId: s.task.id, strategy: this.name, workcell: s.workcellName });
    await s.workcell.createWorkspace({ id: s.workspaceId, kind: 'clone', remote: s.remote, sha: reg.sha, branch: `agent/${s.agentId}` });
    s.pin = reg.pin;
  }

  async beforeTool(): Promise<string[]> {
    return []; // git tells you nothing until you merge
  }

  abstract requiresGreenForSubmit(s: AgentSession): boolean;
  abstract land(s: AgentSession, message: string): Promise<LandOutcome>;
  abstract describe(): string;

  protected st(s: AgentSession): GitState {
    return s.state as GitState;
  }

  /** Finish an in-progress rebase once the agent has resolved the conflict markers. */
  protected async continueRebase(s: AgentSession): Promise<LandOutcome | null> {
    const st = this.st(s);
    const unresolved = await this.filesWithMarkers(s, st.conflictFiles ?? []);
    if (unresolved.length > 0) {
      return { landed: false, message: `rebase in progress: conflict markers remain in ${unresolved.join(', ')}. Resolve them (keep both sides' intent), then submit again.` };
    }
    const r = await s.workcell.git(s.workspaceId, 'rebase-continue');
    if (r.conflicts && r.conflicts.length > 0) return this.conflicted(s, r.conflicts);
    st.rebasing = false;
    st.conflictFiles = [];
    return null;
  }

  /** Rebase the branch onto the latest main. Returns null if clean; reports whether history changed. */
  protected async rebaseOntoMain(s: AgentSession): Promise<{ outcome: LandOutcome | null; moved: boolean }> {
    await s.workcell.git(s.workspaceId, 'fetch', { ref: MAIN });
    const before = (await s.workcell.git(s.workspaceId, 'head')).sha;
    const r = await s.workcell.git(s.workspaceId, 'rebase', { ref: MAIN });
    if (r.conflicts && r.conflicts.length > 0) return { outcome: await this.conflicted(s, r.conflicts), moved: true };
    const after = (await s.workcell.git(s.workspaceId, 'head')).sha;
    const moved = before !== after;
    if (moved) {
      s.stats.rebases++;
      s.bumpView();
      await s.emit({ type: 'rebase', agentId: s.agentId, conflicts: 0, at: s.now() });
    }
    return { outcome: null, moved };
  }

  protected async conflicted(s: AgentSession, files: string[]): Promise<LandOutcome> {
    const st = this.st(s);
    st.rebasing = true;
    st.conflictFiles = files;
    s.stats.rebases++;
    s.stats.conflicts += files.length;
    s.bumpView();
    await s.emit({ type: 'rebase', agentId: s.agentId, conflicts: files.length, at: s.now() });
    await s.emit({ type: 'promotion.rejected', agentId: s.agentId, reason: 'needs-rebase', paths: files, at: s.now() });
    return {
      landed: false,
      invalidateTests: true,
      state: { state: 'working', detail: `resolving rebase conflicts in ${files.join(', ')}` },
      message: `MERGE CONFLICT while rebasing onto main in: ${files.join(', ')}.\nThose files now contain <<<<<<< / ======= / >>>>>>> conflict markers. Edit them to combine both sides correctly (remove the markers), then call submit again to continue.`,
    };
  }

  protected async commit(s: AgentSession, message: string): Promise<void> {
    await s.workcell.git(s.workspaceId, 'commit', { message: `${s.task.id}: ${message}`.slice(0, 200) });
  }

  /** Push HEAD to main (non-force). On success, record the landing for metrics. */
  protected async pushToMain(s: AgentSession): Promise<{ landed: boolean; sha?: string }> {
    const diff = await s.workcell.git(s.workspaceId, 'diff');
    const paths = changedPaths(diff.diff ?? '');
    const push = await s.workcell.git(s.workspaceId, 'push', { remoteRef: MAIN_REF });
    if (!push.ok || push.rejected) {
      await s.emit({ type: 'promotion.rejected', agentId: s.agentId, reason: 'push-rejected', paths: [], at: s.now() });
      return { landed: false };
    }
    const changes: Record<string, ChangeClass> = Object.fromEntries(paths.map((p) => [p, 'body' as const]));
    await s.coordinator.recordExternalLanding({ agentId: s.agentId, taskId: s.task.id, sha: push.sha ?? '', parentSha: null, changes });
    await s.coordinator.finish(s.agentId, 'landed');
    return { landed: true, sha: push.sha };
  }

  private async filesWithMarkers(s: AgentSession, files: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const f of files) {
      try {
        const { content } = await s.workcell.read(s.workspaceId, f);
        if (/^(<<<<<<<|>>>>>>>) /m.test(content) || /^=======$/m.test(content)) out.push(f);
      } catch {
        // deleted in resolution: fine
      }
    }
    return out;
  }
}

/**
 * GitHub PR flow with "require branches to be up to date": the PR must be rebased on
 * the current main and CI (the task tests) must pass on that exact head before merging.
 * If someone merges first, the PR is out of date again.
 */
export class PrFlowStrategy extends GitBaseline {
  readonly name = 'pr-flow' as const;

  requiresGreenForSubmit(s: AgentSession): boolean {
    return !this.st(s).rebasing;
  }

  async land(s: AgentSession, message: string): Promise<LandOutcome> {
    const st = this.st(s);
    if (st.rebasing) {
      const blocked = await this.continueRebase(s);
      if (blocked) return blocked;
      return { landed: false, attempted: false, invalidateTests: true, message: 'Conflicts resolved and rebase completed. CI must pass on the rebased branch: re-run the tests, then submit again.' };
    }
    await this.commit(s, message);
    const { outcome, moved } = await this.rebaseOntoMain(s);
    if (outcome) return outcome;
    if (moved) {
      return { landed: false, invalidateTests: true, message: 'Your PR was out of date with main and has been rebased onto the latest main (no conflicts). Branch protection requires CI to pass on the updated branch: re-run the tests, then submit again.' };
    }
    const pushed = await this.pushToMain(s);
    if (!pushed.landed) {
      return { landed: false, message: 'Merge blocked: another PR merged first, so your branch is out of date again. Submit again to update it.' };
    }
    return { landed: true, message: `MERGED into main (${pushed.sha?.slice(0, 10)}). Task complete.`, state: { state: 'landed', detail: 'merged into main' } };
  }

  describe(): string {
    return [
      'Version control: GitHub pull-request flow. You work on your own branch, cloned from main when you started.',
      'submit opens/updates your PR and tries to merge it. Branch protection requires the branch to be up to date with main and CI (your task tests) to pass on the up-to-date branch.',
      'If main moved, submit rebases your branch; on conflicts you must resolve the conflict markers and submit again; after any rebase you must re-run tests before submitting.',
    ].join('\n');
  }
}

/**
 * Cursor-style: everyone commits to one shared branch. On a rejected push the worker
 * pulls with rebase, resolves conflicts itself, and pushes again. No re-test is required
 * after a rebase (a small error rate is accepted).
 */
export class PushToBranchStrategy extends GitBaseline {
  readonly name = 'push-to-branch' as const;

  requiresGreenForSubmit(s: AgentSession): boolean {
    const st = this.st(s);
    return !st.submittedOnce && !st.rebasing;
  }

  async land(s: AgentSession, message: string): Promise<LandOutcome> {
    const st = this.st(s);
    st.submittedOnce = true;
    if (st.rebasing) {
      const blocked = await this.continueRebase(s);
      if (blocked) return blocked;
    } else {
      await this.commit(s, message);
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const pushed = await this.pushToMain(s);
      if (pushed.landed) return { landed: true, message: `PUSHED to main (${pushed.sha?.slice(0, 10)}). Task complete.`, state: { state: 'landed', detail: 'pushed to main' } };
      const { outcome } = await this.rebaseOntoMain(s);
      if (outcome) return outcome;
    }
    return { landed: false, message: 'push keeps getting rejected (main is moving fast); submit again.' };
  }

  describe(): string {
    return [
      'Version control: one shared branch. You work in your own clone; submit commits and pushes straight to main.',
      'If someone pushed first, submit pulls with rebase and pushes again. On conflicts you must resolve the conflict markers yourself and submit again.',
    ].join('\n');
  }
}

/** Parse `diff --git a/x b/y` headers. */
export function changedPaths(diff: string): string[] {
  const out = new Set<string>();
  for (const m of diff.matchAll(/^diff --git a\/(\S+) b\/(\S+)$/gm)) {
    if (m[2]) out.add(m[2]);
  }
  return [...out];
}
