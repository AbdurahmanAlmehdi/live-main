/** Scratch copies of the demo repo for applying solutions and running its tests. */
import { cpSync, mkdtempSync, realpathSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEMO_REPO } from './paths.ts';

export interface Workspace {
  dir: string;
  dispose(): void;
}

/**
 * Copies demo-repo (without node_modules) into a fresh temp dir and symlinks
 * node_modules back to demo-repo/node_modules (run `npm ci` there first).
 */
export function createWorkspace(label = 'ws', source = DEMO_REPO): Workspace {
  if (!existsSync(join(DEMO_REPO, 'node_modules/vitest'))) {
    throw new Error('demo-repo/node_modules is missing: run `npm ci` in demo-repo first');
  }
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `livemain-${label}-`)));
  cpSync(source, dir, {
    recursive: true,
    filter: (src) => !src.includes('/node_modules') && !src.endsWith('/.git'),
  });
  symlinkSync(join(DEMO_REPO, 'node_modules'), join(dir, 'node_modules'), 'dir');
  return { dir, dispose: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Copies a workspace's files (not node_modules) to a new workspace. */
export function cloneWorkspace(from: Workspace, label = 'clone'): Workspace {
  return createWorkspace(label, from.dir);
}
