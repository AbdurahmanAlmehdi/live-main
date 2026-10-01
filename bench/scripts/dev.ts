/**
 * Development loop: copies demo-repo to a temp dir, drops in reference helpers and
 * reference functions directly (bypassing solutions/*.json), and runs vitest.
 *
 *   tsx scripts/dev.ts [--keep] [--no-helpers] [--fns NAME,NAME|all] [tests/... filters]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { allSpecs } from '../defs/functions/index.ts';
import { fileNameOf } from '../defs/types.ts';
import { REFERENCE } from '../src/paths.ts';
import { REGISTRY_ANCHOR, REGISTRY_PATH } from '../src/bank.ts';
import { createWorkspace } from '../src/workspace.ts';
import { runVitest } from '../src/vitest.ts';
import { registryLine } from '../src/registry.ts';

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const fnsIdx = args.indexOf('--fns');
const fnsArg = fnsIdx >= 0 ? args[fnsIdx + 1] : 'all';
const filters = args.filter((a, i) => !a.startsWith('--') && (fnsIdx < 0 || i !== fnsIdx + 1));

const ws = createWorkspace('dev');
if (!args.includes('--no-helpers')) {
  for (const f of readdirSync(join(REFERENCE, 'helpers'))) copyFileSync(join(REFERENCE, 'helpers', f), join(ws.dir, 'src/helpers', f));
}
const wanted = fnsArg === 'all' ? undefined : new Set(fnsArg.split(','));
let lines = '';
let count = 0;
for (const spec of allSpecs) {
  if (wanted && !wanted.has(spec.name)) continue;
  const src = join(REFERENCE, 'functions', spec.category, `${fileNameOf(spec.name)}.ts`);
  if (!existsSync(src)) continue;
  mkdirSync(join(ws.dir, 'src/functions', spec.category), { recursive: true });
  copyFileSync(src, join(ws.dir, 'src/functions', spec.category, `${fileNameOf(spec.name)}.ts`));
  lines += registryLine(spec.name, spec.category);
  count++;
}
const regPath = join(ws.dir, REGISTRY_PATH);
writeFileSync(regPath, readFileSync(regPath, 'utf8').replace(REGISTRY_ANCHOR, lines + REGISTRY_ANCHOR));
console.log(`workspace ${ws.dir}: ${count} functions`);
const result = runVitest(ws.dir, filters);
for (const f of result.files) {
  if (f.ok) continue;
  console.log(`FAIL ${f.file} (${f.passed} passed, ${f.failed} failed)`);
  for (const x of f.failures.slice(0, 12)) console.log(`   ${x.name}: ${x.message.slice(0, 220)}`);
}
console.log(`${result.files.filter((f) => f.ok).length}/${result.files.length} files ok, ${result.passed} passed, ${result.failed} failed (${result.durationMs} ms)`);
if (!keep) ws.dispose();
process.exit(result.ok ? 0 : 1);
