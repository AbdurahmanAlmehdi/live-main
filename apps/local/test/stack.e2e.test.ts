/**
 * Real-stack test: Docker workcells (FUSE livefs), git server, integrator, the in-process
 * coordinator, and scripted agents under each strategy. Runs only with LIVEMAIN_E2E=1
 * (needs Docker with FUSE and the livemain/workcell:dev image: `pnpm livemain build`).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentSession, createStrategy, runScriptedAgent } from '@livemain/agent';
import { LocalCoordinatorClient } from '@livemain/core';
import type { Solution, StrategyName, Task } from '@livemain/protocol';
import { beforeAll, describe, expect, it } from 'vitest';
import { Hub } from '../src/hub.js';
import { createRepo, upStack, type Stack } from '../src/stack.js';

const E2E = process.env.LIVEMAIN_E2E === '1';
const MARKER = '  // functions (one per line, keep this marker as the last line inside the object)';

const fn = (name: string, body: string): { task: Task; solution: Solution } => ({
  task: { id: `fn-${name}`, kind: 'leaf', title: `Implement ${name}`, prompt: name, tests: [`tests/functions/${name}.test.ts`], dependsOn: [] },
  solution: {
    taskId: `fn-${name}`,
    variants: [
      {
        requires: [],
        ops: [
          {
            op: 'write',
            path: `src/functions/math/${name}.ts`,
            content: `import type { FormulaFunction } from '../../core/types';\nimport { toNumber } from '../../core/value';\n\nconst ${name}: FormulaFunction = (args) => (args.length === 0 ? 0 : Math.${name.toLowerCase()}(...args.map(toNumber)));\n\nexport default ${name};\n`,
          },
          { op: 'insertBefore', path: 'src/core/registry.ts', anchor: MARKER, text: `  ${name}: () => import('../functions/math/${name}'),\n` },
        ],
      },
    ],
  },
});

describe.skipIf(!E2E)('real stack', () => {
  let stack: Stack;
  const hub = new Hub(mkdtempSync(join(tmpdir(), 'livemain-e2e-')), null);

  beforeAll(async () => {
    stack = await upStack({ workcells: 2, portBase: 19_090 });
  }, 180_000);

  for (const strategy of ['live-main', 'pr-flow', 'push-to-branch'] as StrategyName[]) {
    it(`${strategy}: two concurrent agents both land and main is green`, async () => {
      const runId = `e2e-${strategy}-${Date.now()}`;
      const remote = await createRepo(stack, runId);
      const { sha } = await stack.integrator.seed(remote, '/seed/fixture-repo', 'seed fixture');
      const run = hub.createRun(runId, strategy, stack.integrator, remote);
      run.coord.init(sha);
      const coordinator = new LocalCoordinatorClient(run.coord);
      const jobs = [fn('MIN', ''), fn('MAX', '')];
      const sessions = jobs.map(
        (j, i) =>
          new AgentSession({
            agentId: `${runId}-${i}`,
            task: j.task,
            strategy: createStrategy(strategy),
            workcell: stack.workcells[i % stack.workcells.length]!.client,
            workcellName: stack.workcells[i % stack.workcells.length]!.name,
            coordinator,
            remote,
          }),
      );
      await Promise.all(sessions.map((s) => s.start()));
      const results = await Promise.all(sessions.map((s, i) => runScriptedAgent(s, { solution: jobs[i]!.solution })));
      for (const s of sessions) await s.close();
      expect(results.map((r) => r.outcome)).toEqual(['landed', 'landed']);

      const head = run.coord.head();
      expect(head.version).toBe(3);
      const ci = await stack.integrator.ci(remote, head.sha);
      expect(ci.failed).toBe(0);
      expect(ci.files.every((f) => f.ok)).toBe(true);
      const types = run.coord.events().map((e) => e.event.type);
      if (strategy === 'live-main') {
        // The second promotion auto-merged the registry: no rebase anywhere.
        expect(types).not.toContain('rebase');
      } else {
        // Both agents append to the registry: the second one must rebase.
        expect(types).toContain('rebase');
      }
      const registry = await fetch(`${stack.gitserverUrl}/repos/${runId}/file?ref=${head.sha}&path=src/core/registry.ts`).then((r) => r.text());
      expect(registry).toContain('MIN:');
      expect(registry).toContain('MAX:');
      run.close();
    }, 300_000);
  }
});
