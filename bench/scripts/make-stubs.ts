/**
 * Derives the stubbed helpers in demo-repo/src/helpers from the reference helpers in
 * bench/reference/helpers: exported types, constants and documented signatures are kept,
 * every exported function body becomes `throw new NotImplementedError(...)`, and private
 * code is dropped. Keeps stub and reference signatures identical by construction.
 *
 * Usage: tsx scripts/make-stubs.ts [--check]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { DEMO_REPO, REFERENCE } from '../src/paths.ts';
import { HELPERS } from '../defs/helpers.ts';

function leadingComments(source: string, node: ts.Node, sf: ts.SourceFile): { attached: string; detached: string } {
  const ranges = ts.getLeadingCommentRanges(source, node.getFullStart()) ?? [];
  let attached = '';
  let detached = '';
  ranges.forEach((r, i) => {
    const text = source.slice(r.pos, r.end);
    const nextStart = i + 1 < ranges.length ? ranges[i + 1].pos : node.getStart(sf);
    const gap = source.slice(r.end, nextStart);
    if (/\n\s*\n/.test(gap)) {
      if (text.startsWith('/**')) detached += `${text}\n\n`;
    }
    else attached += `${text}\n`;
  });
  return { attached, detached };
}

function isExported(node: ts.Node): boolean {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

export function makeStub(file: string, source: string): string {
  const sf = ts.createSourceFile(`${file}.ts`, source, ts.ScriptTarget.ES2022, true);
  const imports: { names: string[]; from: string }[] = [];
  const body: string[] = [];
  for (const stmt of sf.statements) {
    const { attached, detached } = leadingComments(source, stmt, sf);
    if (ts.isImportDeclaration(stmt)) {
      const bindings = stmt.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        imports.push({ names: bindings.elements.map((e) => e.name.text), from: (stmt.moduleSpecifier as ts.StringLiteral).text });
      }
      if (detached) body.push(detached.trimEnd() + '\n');
      continue;
    }
    if (detached) body.push(detached.trimEnd() + '\n');
    if (!isExported(stmt)) continue;
    if (ts.isFunctionDeclaration(stmt) && stmt.body) {
      const signature = source.slice(stmt.getStart(sf), stmt.body.getStart(sf)).trimEnd();
      const name = stmt.name?.text ?? 'function';
      body.push(`${attached}${signature} {\n  throw new NotImplementedError('${name} (src/helpers/${file}.ts)');\n}\n`);
    } else {
      body.push(`${attached}${source.slice(stmt.getStart(sf), stmt.getEnd())}\n`);
    }
  }
  const text = body.join('\n');
  const importLines = imports
    .map(({ names, from }) => ({ names: names.filter((n) => new RegExp(`\\b${n}\\b`).test(text)), from }))
    .filter(({ names }) => names.length > 0)
    .map(({ names, from }) => `import type { ${names.join(', ')} } from '${from}';`);
  return [...importLines, `import { NotImplementedError } from '../core/errors';`, '', text.trimEnd(), ''].join('\n');
}

function main(): void {
  const check = process.argv.includes('--check');
  const dir = join(REFERENCE, 'helpers');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => f.replace(/\.ts$/, ''));
  const declared = new Set(HELPERS.map((h) => h.file));
  let changed = 0;
  for (const file of files) {
    if (!declared.has(file)) throw new Error(`reference/helpers/${file}.ts has no helper task in defs/helpers.ts`);
    const stub = makeStub(file, readFileSync(join(dir, `${file}.ts`), 'utf8'));
    const out = join(DEMO_REPO, 'src/helpers', `${file}.ts`);
    if (existsSync(out) && readFileSync(out, 'utf8') === stub) continue;
    changed++;
    if (!check) writeFileSync(out, stub);
  }
  for (const h of HELPERS) if (!files.includes(h.file)) throw new Error(`helper task ${h.id} has no reference/helpers/${h.file}.ts`);
  console.log(`${files.length} helper stubs, ${changed} ${check ? 'out of date' : 'written'}`);
  if (check && changed > 0) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
