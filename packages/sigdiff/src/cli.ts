import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { sigdiff } from './index.js';

function readMaybe(file: string): string | null {
  if (file === '/dev/null') return null;
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function serve(): void {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let out: unknown;
    try {
      const req = JSON.parse(line) as { old: string | null; new: string | null; path?: string; id?: unknown };
      out = { id: req.id, ...sigdiff(req.old ?? null, req.new ?? null, req.path ?? 'file.ts') };
    } catch (err) {
      out = { error: String(err), class: 'body', severity: 'review', reason: 'sigdiff failed', symbols: { added: [], removed: [], bodyChanged: [], signatureChanged: [] } };
    }
    process.stdout.write(`${JSON.stringify(out)}\n`);
  });
}

function main(argv: string[]): number {
  if (argv[0] === '--serve') {
    serve();
    return -1;
  }
  const pathIdx = argv.indexOf('--path');
  const repoPath = pathIdx >= 0 ? argv[pathIdx + 1] : undefined;
  const files = argv.filter((_, i) => i !== pathIdx && i !== pathIdx + 1);
  if (files.length !== 2) {
    process.stderr.write('usage: sigdiff <old|/dev/null> <new|/dev/null> [--path <repo path>]\n       sigdiff --serve\n');
    return 2;
  }
  const [oldFile, newFile] = files as [string, string];
  const res = sigdiff(readMaybe(oldFile), readMaybe(newFile), repoPath ?? (newFile !== '/dev/null' ? newFile : oldFile));
  process.stdout.write(`${JSON.stringify(res)}\n`);
  return 0;
}

const code = main(process.argv.slice(2));
if (code >= 0) process.exitCode = code;
