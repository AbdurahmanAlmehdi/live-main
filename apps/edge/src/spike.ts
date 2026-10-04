import { json } from '@livemain/core';
import { integratorName, workcellClient } from './clients.js';
import { authedRepoRemote, type Env } from './env.js';

interface StepResult {
  step: string;
  ok: boolean;
  ms: number;
  detail: string;
}

/**
 * PLAN.md Phase 0, Spike B: an Artifacts round trip from Cloudflare.
 * create → seed from a container (git push) → readFile from the Worker → fork →
 * fast-forward-only check (a second, non-fast-forward push must be rejected, since the
 * coordinator relies on push acting as compare-and-swap).
 * POST /api/spikes/artifacts → a step-by-step report.
 */
export async function artifactsSpike(env: Env): Promise<Response> {
  if (!env.ARTIFACTS) return json({ error: 'no-artifacts', message: 'the ARTIFACTS binding is not configured' }, 400);
  const artifacts = env.ARTIFACTS;
  const name = `spike-${Date.now().toString(36)}`;
  const steps: StepResult[] = [];
  const time = async <T>(step: string, f: () => Promise<T>, describe: (v: T) => string): Promise<T | undefined> => {
    const t0 = Date.now();
    try {
      const v = await f();
      steps.push({ step, ok: true, ms: Date.now() - t0, detail: describe(v) });
      return v;
    } catch (err) {
      steps.push({ step, ok: false, ms: Date.now() - t0, detail: err instanceof Error ? err.message : String(err) });
      return undefined;
    }
  };

  const repo = await time('create repo', () => artifacts.create(name, { description: 'Live Main spike' }), (r) => r.remote);
  if (!repo) return json({ name, steps }, 502);
  const remote = authedRepoRemote(repo);
  const wc = workcellClient(env, integratorName(name), 'integrator');
  const seeded = await time('seed main from the integrator container (git push)', () => wc.seed(remote, '/seed/fixture-repo', 'spike seed'), (r) => r.sha);
  if (seeded) {
    await time(
      'readFile from the Worker',
      async () => {
        using handle = await artifacts.get(name);
        const blob = await handle.readFile({ ref: seeded.sha, path: 'package.json' });
        if (!blob) throw new Error('readFile returned null');
        return blob.text();
      },
      (text) => `${text.length} bytes of package.json`,
    );
    await time(
      'fork',
      async () => {
        using handle = await artifacts.get(name);
        return handle.fork(`${name}-fork`, { description: 'spike fork' });
      },
      (f) => f.remote,
    );
    // Two clones from the seed both push to main: the second must be rejected.
    await time(
      'non-fast-forward push is rejected',
      async () => {
        const w = workcellClient(env, `workcell:${name}:0`, 'workcell');
        for (const id of ['spike-a', 'spike-b']) {
          await w.createWorkspace({ id, kind: 'clone', remote, sha: seeded.sha, branch: `spike/${id}` });
          await w.write(id, `${id}.txt`, `${id}\n`);
          await w.git(id, 'commit', { message: id });
        }
        const first = await w.git('spike-a', 'push', { remoteRef: 'refs/heads/main' });
        const second = await w.git('spike-b', 'push', { remoteRef: 'refs/heads/main' });
        if (!first.ok) throw new Error(`first push failed: ${first.output}`);
        if (second.ok && !second.rejected) throw new Error('non-fast-forward push was accepted: push is not a compare-and-swap');
        return second.output ?? 'rejected';
      },
      (out) => `rejected as expected (${String(out).trim().slice(0, 120)})`,
    );
  }
  const ok = steps.every((s) => s.ok);
  return json({ name, ok, steps }, ok ? 200 : 502);
}
