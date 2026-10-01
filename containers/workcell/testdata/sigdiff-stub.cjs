#!/usr/bin/env node
// Minimal stand-in for packages/sigdiff implementing the CLI and --serve
// protocol from docs/workcell-api.md with line heuristics (used by Go unit
// tests; never a substitute for the real TS-aware differ):
//   identical / whitespace-only        -> none
//   new file, or only inserted lines   -> additive
//   an `export ...` line changed/removed or file deleted -> signature
//   anything else                      -> body
'use strict';
const fs = require('fs');
const readline = require('readline');

const SEVERITY = { none: 'ignore', additive: 'ignore', body: 'review', signature: 'interrupt' };

function lines(s) {
  return s.split('\n');
}

function isSubsequence(base, side) {
  let j = 0;
  for (const line of base) {
    while (j < side.length && side[j] !== line) j++;
    if (j === side.length) return false;
    j++;
  }
  return true;
}

function classify(oldText, newText, path) {
  const result = (cls, reason) => ({
    class: cls,
    severity: SEVERITY[cls],
    reason: `${path}: ${reason}`,
    symbols: { added: [], removed: [], bodyChanged: [], signatureChanged: [] },
  });
  if (oldText === newText) return result('none', 'unchanged');
  if (oldText === null) return result('additive', 'new file');
  if (newText === null) return result('signature', 'file deleted');
  if (oldText.replace(/\s+/g, '') === newText.replace(/\s+/g, '')) return result('none', 'whitespace only');
  const a = lines(oldText);
  const b = lines(newText);
  if (isSubsequence(a, b)) return result('additive', 'lines added');
  const exportsOf = (ls) => new Set(ls.filter((l) => l.startsWith('export ')).map((l) => l.trim()));
  const ea = exportsOf(a);
  const eb = exportsOf(b);
  for (const e of ea) if (!eb.has(e)) return result('signature', `export changed: ${e}`);
  return result('body', 'body changed');
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--serve') {
    const rl = readline.createInterface({ input: process.stdin });
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let req;
      try {
        req = JSON.parse(line);
      } catch {
        return;
      }
      const res = classify(req.old ?? null, req.new ?? null, req.path ?? '');
      if (req.id !== undefined) res.id = req.id;
      process.stdout.write(JSON.stringify(res) + '\n');
    });
    return;
  }
  const read = (f) => (f === '/dev/null' ? null : fs.readFileSync(f, 'utf8'));
  const i = args.indexOf('--path');
  const path = i >= 0 ? args[i + 1] : args[1];
  process.stdout.write(JSON.stringify(classify(read(args[0]), read(args[1]), path)) + '\n');
}

main();
