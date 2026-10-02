import type { ChangeClass, IntegrateRequest, IntegrateResponse } from '@livemain/protocol';
import type { Integrator } from './coordinator.js';

const CLASS_MARKER = /^\/\/ synth:(none|additive|body|signature)/;

/**
 * Integrator stand-in for the synthetic stress test: no git, no tests. It enforces the
 * same compare-and-swap on the head and derives each change's class from a
 * `// synth:<class>` marker on the first line of the content. Used only for coordinator
 * scale measurements, which are reported as synthetic.
 */
export class SyntheticIntegrator implements Integrator {
  private head: string | null;
  private n = 0;

  /**
   * @param seedSha current head, or null to adopt the first expectedHeadSha (after a restart)
   * @param latencyMs artificial integrator latency, to model git + push time
   */
  constructor(
    seedSha: string | null,
    private readonly latencyMs = 0,
  ) {
    this.head = seedSha;
  }

  async integrate(req: IntegrateRequest): Promise<IntegrateResponse> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    this.head ??= req.expectedHeadSha;
    if (req.expectedHeadSha !== this.head) return { ok: false, error: 'head-moved', actualHeadSha: this.head };
    const parent = this.head;
    this.head = `synth-${Date.now().toString(36)}-${++this.n}`;
    const classes: Record<string, ChangeClass> = {};
    for (const c of req.changes) {
      const m = c.content === null ? null : CLASS_MARKER.exec(c.content);
      classes[c.path] = c.content === null ? 'signature' : ((m?.[1] as ChangeClass | undefined) ?? 'body');
    }
    return {
      ok: true,
      sha: this.head,
      parent,
      changedPaths: req.changes.map((c) => c.path),
      classes,
      merged: req.autoMerge.map((path) => ({ path, method: 'union' })),
      impact: null,
      impactRan: [],
    };
  }
}
