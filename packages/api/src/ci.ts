import type { Coordinator, WorkcellClient } from '@livemain/core';

/**
 * Post-land CI on main: whenever main advances, run the full suite on the newest head
 * (coalescing intermediate versions) and record the result. This is the safety net and
 * the source of the "time to all-green" and "regressions" metrics, for every strategy.
 */
export class CiLoop {
  private stopped = false;
  private lastVersion = 0;
  private loop: Promise<void> | null = null;

  constructor(
    private readonly coord: Coordinator,
    private readonly integrator: WorkcellClient,
    private readonly remote: string,
    private readonly log: (s: string) => void = () => undefined,
    /** test files/filters to run (default: the whole suite); a function is re-read on every run */
    private readonly files?: string[] | (() => string[] | undefined),
    private readonly intervalMs = 1500,
  ) {}

  start(): void {
    this.loop = this.run();
  }

  /** Run CI on the current head once more (if it moved), then stop. */
  async stop(): Promise<void> {
    this.stopped = true;
    await this.loop;
    await this.once();
  }

  private async run(): Promise<void> {
    while (!this.stopped) {
      await this.once();
      await new Promise((r) => setTimeout(r, this.intervalMs));
    }
  }

  async once(): Promise<void> {
    const head = this.coord.head();
    if (head.version === this.lastVersion) return;
    try {
      const files = typeof this.files === 'function' ? this.files() : this.files;
      const result = await this.integrator.ci(this.remote, head.sha, files);
      this.lastVersion = head.version;
      this.coord.recordCi(head.version, head.sha, result);
      this.log(`ci v${head.version}: ${result.passed} tests passed, ${result.failed} failed`);
    } catch (err) {
      this.log(`ci v${head.version} error: ${String(err)}`);
    }
  }
}
