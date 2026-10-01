/**
 * Cross-checks a sample of the oracle test expectations against LibreOffice Calc
 * (headless, in a Debian container), as PLAN.md Phase 1 asks: formula.js produced the
 * oracle values; LibreOffice is an independent spreadsheet implementation.
 *
 * Usage: tsx oracle/libreoffice.ts [--sample 300] [--seed 1]
 * Writes oracle/libreoffice-report.json and prints agreement by category.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCH, DEMO_REPO } from '../src/paths.ts';

interface Case {
  file: string;
  formula: string;
  expected: number;
}

const CASE = /evaluate\(\s*'(=[^']+)'\s*\)\)\.toBeCloseTo\(\s*(-?[\d.eE+-]+)/g;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

/** Numeric, cell-free cases only (array literals and text are fine in LibreOffice too). */
function collect(): Case[] {
  const dir = join(DEMO_REPO, 'tests', 'functions');
  const out: Case[] = [];
  for (const f of readdirSync(dir).sort()) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(CASE)) {
      const formula = m[1]!.replace(/\\'/g, "'");
      const expected = Number(m[2]);
      if (Number.isFinite(expected)) out.push({ file: f, formula, expected });
    }
  }
  return out;
}

function sample<T>(xs: T[], n: number, seed: number): T[] {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const copy = [...xs];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

/** One formula per line, Excel syntax (en-US), CSV-quoted; LibreOffice evaluates on import. */
function csv(cases: Case[]): string {
  return cases.map((c) => `"${c.formula.replace(/"/g, '""')}"`).join('\n') + '\n';
}

function main(): void {
  const all = collect();
  const cases = sample(all, Number(arg('sample', '300')), Number(arg('seed', '1')));
  const work = join(BENCH, '.libreoffice');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'oracle.csv'), csv(cases));
  console.log(`${all.length} numeric oracle cases; checking ${cases.length} with LibreOffice …`);
  // A small image with headless LibreOffice Calc (oracle/libreoffice-image/Dockerfile).
  execFileSync('docker', ['build', '-q', '-t', 'livemain/libreoffice', join(BENCH, 'oracle', 'libreoffice-image')], { stdio: 'ignore' });
  // Import: field sep ';', quote '"', UTF-8, en-US, evaluate formulas (token 12). Export: computed values.
  execFileSync(
    'docker',
    [
      'run', '--rm', '-v', `${work}:/work`, 'livemain/libreoffice', 'soffice', '--headless',
      '--infilter=CSV:59,34,76,1,,1033,false,false,false,false,false,true',
      '--convert-to', 'csv:Text - txt - csv (StarCalc):59,34,76,1,,1033,false,true,false,false,false,-1',
      '--outdir', 'out', 'oracle.csv',
    ],
    { stdio: 'ignore' },
  );
  const outFile = readdirSync(join(work, 'out')).find((f) => f.endsWith('.csv'));
  if (!outFile) throw new Error('LibreOffice produced no output');
  const lines = readFileSync(join(work, 'out', outFile), 'utf8').split(/\r?\n/);
  const results = cases.map((c, i) => {
    const raw = (lines[i] ?? '').replace(/^"|"$/g, '');
    const got = Number(raw);
    const tol = Math.max(1e-6, Math.abs(c.expected) * 1e-6);
    const agree = raw !== '' && Number.isFinite(got) && Math.abs(got - c.expected) <= tol;
    const unsupported = /^(#NAME\?|Err:5\d\d)$/.test(raw);
    return { ...c, libreoffice: raw, agree, unsupported };
  });
  const byFile = new Map<string, { agree: number; total: number }>();
  for (const r of results) {
    const k = byFile.get(r.file) ?? { agree: 0, total: 0 };
    k.total++;
    if (r.agree) k.agree++;
    byFile.set(r.file, k);
  }
  const agree = results.filter((r) => r.agree).length;
  const unsupported = results.filter((r) => r.unsupported);
  const disagreements = results.filter((r) => !r.agree && !r.unsupported);
  const comparable = results.length - unsupported.length;
  writeFileSync(
    join(BENCH, 'oracle', 'libreoffice-report.json'),
    JSON.stringify({ checked: results.length, comparable, agree, unsupported: unsupported.map((u) => u.formula), disagreements }, null, 2),
  );
  console.log(
    `LibreOffice agrees with the oracle on ${agree}/${comparable} comparable sampled cases (${((agree / Math.max(1, comparable)) * 100).toFixed(1)}%); ${unsupported.length} use functions LibreOffice lacks under these names.`,
  );
  for (const d of disagreements.slice(0, 25)) console.log(`  ${d.file}: ${d.formula} oracle=${d.expected} libreoffice=${d.libreoffice}`);
  if (!process.env.KEEP) rmSync(work, { recursive: true, force: true });
}

main();
