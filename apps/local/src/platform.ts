import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';
import { GitServerHost, newMasterKey, webCryptoVault, type Platform, type Template } from '@livemain/api';
import { nodeSqlStore } from '@livemain/core/node';
import type { Solution, TaskBank } from '@livemain/protocol';
import type { Stack } from './stack.js';

/** The demo formula engine with its benchmark task bank and reference solutions. */
export function formulaEngineTemplate(repoRoot: string): Template {
  const bench = join(repoRoot, 'bench');
  const bank = JSON.parse(readFileSync(join(bench, 'tasks.json'), 'utf8')) as TaskBank;
  const cache = new Map<string, Solution | undefined>();
  return {
    id: 'formula-engine',
    name: 'Formula engine (demo)',
    description: 'A TypeScript spreadsheet formula engine, stubbed, with 336 tasks and their acceptance tests',
    seed: { kind: 'dir', dir: '/seed/demo-repo' },
    tasks: bank.tasks,
    solution(taskId, naive = false) {
      const key = `${taskId}${naive ? '.naive' : ''}`;
      if (!cache.has(key)) {
        const file = join(bench, 'solutions', `${key}.json`);
        cache.set(key, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Solution) : undefined);
      }
      return cache.get(key);
    },
  };
}

/** A 32-byte master key from LIVEMAIN_MASTER_KEY, or a file created once with mode 0600. */
function masterKey(dataDir: string): string {
  if (process.env.LIVEMAIN_MASTER_KEY) return process.env.LIVEMAIN_MASTER_KEY;
  const file = join(dataDir, 'master.key');
  if (!existsSync(file)) {
    writeFileSync(file, newMasterKey(), { mode: 0o600 });
    chmodSync(file, 0o600);
  }
  return readFileSync(file, 'utf8').trim();
}

export function localPlatform(stack: Stack, repoRoot: string, dataDir: string): Platform {
  mkdirSync(dataDir, { recursive: true });
  const login = process.env.LIVEMAIN_USER ?? userInfo().username;
  return {
    git: new GitServerHost(stack.gitserverUrl),
    sql: (name) => nodeSqlStore(join(dataDir, `${name}.sqlite`)),
    integrator: stack.integrator,
    workcells: stack.workcells,
    vault: webCryptoVault(masterKey(dataDir)),
    templates: [formulaEngineTemplate(repoRoot)],
    session: { user: { login, name: process.env.LIVEMAIN_NAME ?? login }, org: process.env.LIVEMAIN_ORG ?? login, mode: 'local' },
    log: (line) => console.log(line),
  };
}
