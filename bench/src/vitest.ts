/** Runs the demo repo's vitest suite in a directory and summarises the JSON report. */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { DEMO_REPO } from './paths.ts';

export interface FileResult {
  file: string;
  ok: boolean;
  passed: number;
  failed: number;
  failures: { name: string; message: string }[];
}

export interface SuiteResult {
  ok: boolean;
  passed: number;
  failed: number;
  files: FileResult[];
  output: string;
  durationMs: number;
}

interface JsonReport {
  testResults: {
    name: string;
    status: string;
    message?: string;
    assertionResults: { title: string; fullName: string; status: string; failureMessages: string[] }[];
  }[];
}

function vitestArgs(out: string, files: string[]): string[] {
  return [join(DEMO_REPO, 'node_modules/vitest/vitest.mjs'), 'run', ...files, '--reporter=json', `--outputFile=${out}`];
}

function vitestEnv(tmp: string): NodeJS.ProcessEnv {
  return { ...process.env, LIVEMAIN_CACHE_DIR: join(tmp, 'vite-cache'), CI: '1' };
}

export function runVitest(dir: string, files: string[] = []): SuiteResult {
  const tmp = mkdtempSync(join(tmpdir(), 'livemain-vitest-'));
  const out = join(tmp, 'report.json');
  const started = Date.now();
  const proc = spawnSync(process.execPath, vitestArgs(out, files), { cwd: dir, encoding: 'utf8', env: vitestEnv(tmp), maxBuffer: 64 * 1024 * 1024 });
  return summarize(dir, tmp, out, `${proc.stdout ?? ''}${proc.stderr ?? ''}`, started);
}

/** Like runVitest, without blocking (so several workspaces can be tested at once). */
export function runVitestAsync(dir: string, files: string[] = []): Promise<SuiteResult> {
  const tmp = mkdtempSync(join(tmpdir(), 'livemain-vitest-'));
  const out = join(tmp, 'report.json');
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, vitestArgs(out, files), { cwd: dir, env: vitestEnv(tmp) });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    child.on('error', reject);
    child.on('close', () => {
      try {
        resolve(summarize(dir, tmp, out, output, started));
      } catch (e) {
        reject(e);
      }
    });
  });
}

function summarize(dir: string, tmp: string, out: string, output: string, started: number): SuiteResult {
  let report: JsonReport;
  try {
    report = JSON.parse(readFileSync(out, 'utf8')) as JsonReport;
  } catch {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error(`vitest produced no report in ${dir}:\n${output.slice(-4000)}`);
  }
  rmSync(tmp, { recursive: true, force: true });
  const fileResults: FileResult[] = report.testResults.map((r) => {
    const failures = r.assertionResults
      .filter((a) => a.status === 'failed')
      .map((a) => ({ name: a.fullName, message: (a.failureMessages[0] ?? '').split('\n')[0] }));
    if (r.assertionResults.length === 0 && r.status !== 'passed') failures.push({ name: '(file)', message: (r.message ?? 'failed to load').split('\n')[0] });
    const passed = r.assertionResults.filter((a) => a.status === 'passed').length;
    return { file: relative(dir, r.name).split('\\').join('/'), ok: r.status === 'passed' && failures.length === 0, passed, failed: failures.length, failures };
  });
  fileResults.sort((a, b) => a.file.localeCompare(b.file));
  const passed = fileResults.reduce((n, f) => n + f.passed, 0);
  const failed = fileResults.reduce((n, f) => n + f.failed, 0);
  return { ok: failed === 0 && fileResults.every((f) => f.ok), passed, failed, files: fileResults, output, durationMs: Date.now() - started };
}

/** Runs `tsc --noEmit` with the demo repo's tsconfig in `dir`. */
export function runTsc(dir: string): { ok: boolean; output: string } {
  const proc = spawnSync(process.execPath, [join(DEMO_REPO, 'node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'tsconfig.json'], {
    cwd: dir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { ok: proc.status === 0, output: `${proc.stdout ?? ''}${proc.stderr ?? ''}` };
}
