import ts from 'typescript';

import { maxClass, severityOf, type ChangeClass, type Severity } from '@livemain/protocol';

export { maxClass, severityOf, type ChangeClass, type Severity };

export interface SymbolChanges {
  added: string[];
  removed: string[];
  bodyChanged: string[];
  signatureChanged: string[];
}

export interface SigdiffResult {
  class: ChangeClass;
  severity: Severity;
  reason: string;
  symbols: SymbolChanges;
}

const TS_EXT = /\.(c|m)?(t|j)sx?$/;

/** Classify the change from `oldText` to `newText` (null = file absent). */
export function sigdiff(oldText: string | null, newText: string | null, path = 'file.ts'): SigdiffResult {
  const symbols: SymbolChanges = { added: [], removed: [], bodyChanged: [], signatureChanged: [] };
  if (oldText === null && newText === null) return result('none', 'no file on either side', symbols);
  if (oldText === null) {
    symbols.added.push(path);
    return result('additive', `new file ${path}`, symbols);
  }
  if (newText === null) {
    symbols.removed.push(path);
    return result('signature', `file ${path} deleted`, symbols);
  }
  if (oldText === newText) return result('none', 'identical', symbols);
  if (!TS_EXT.test(path)) return diffPlain(oldText, newText, path, symbols);
  return diffTs(oldText, newText, path, symbols);
}

function result(cls: ChangeClass, reason: string, symbols: SymbolChanges): SigdiffResult {
  return { class: cls, severity: severityOf(cls), reason, symbols };
}

function diffPlain(oldText: string, newText: string, path: string, symbols: SymbolChanges): SigdiffResult {
  const norm = (s: string) => s.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const a = norm(oldText);
  const b = norm(newText);
  if (a.join('\n') === b.join('\n')) return result('none', `${path}: whitespace-only change`, symbols);
  // Pure insertion of lines (old is a subsequence of new) is additive.
  if (isSubsequence(a, b)) {
    symbols.added.push(path);
    return result('additive', `${path}: lines added only`, symbols);
  }
  symbols.bodyChanged.push(path);
  return result('body', `${path}: content changed`, symbols);
}

function isSubsequence(a: string[], b: string[]): boolean {
  let i = 0;
  for (const line of b) if (i < a.length && a[i] === line) i++;
  return i === a.length;
}

// ---------- TypeScript entity diff ----------

interface Entity {
  key: string;
  exported: boolean;
  /** Canonical text of the externally visible shape (params, return type, type body). */
  signature: string;
  /** Canonical text of the implementation. */
  body: string;
}

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

function diffTs(oldText: string, newText: string, path: string, symbols: SymbolChanges): SigdiffResult {
  const before = entities(oldText, path);
  const after = entities(newText, path);
  let cls: ChangeClass = 'none';
  const reasons: string[] = [];

  for (const [key, a] of before) {
    const b = after.get(key);
    if (!b) {
      symbols.removed.push(key);
      const c: ChangeClass = a.exported ? 'signature' : 'body';
      cls = maxClass(cls, c);
      reasons.push(`${a.exported ? 'exported ' : ''}${key} removed`);
      continue;
    }
    if (a.signature !== b.signature) {
      const exported = a.exported || b.exported;
      symbols.signatureChanged.push(key);
      cls = maxClass(cls, exported ? 'signature' : 'body');
      reasons.push(`signature of ${exported ? 'export ' : ''}${key} changed: ${clip(a.signature)} → ${clip(b.signature)}`);
    } else if (a.body !== b.body) {
      symbols.bodyChanged.push(key);
      cls = maxClass(cls, 'body');
      reasons.push(`body of ${key} changed`);
    }
  }
  for (const key of after.keys()) {
    if (!before.has(key)) {
      symbols.added.push(key);
      cls = maxClass(cls, 'additive');
      reasons.push(`${key} added`);
    }
  }
  if (cls === 'none') return result('none', `${path}: formatting/comments only`, symbols);
  return result(cls, `${path}: ${summarize(reasons)}`, symbols);
}

function summarize(reasons: string[]): string {
  // Most important first: signature > removed > body > added.
  const weight = (r: string) => (r.startsWith('signature') ? 0 : r.includes('removed') ? 1 : r.startsWith('body') ? 2 : 3);
  const sorted = [...reasons].sort((x, y) => weight(x) - weight(y));
  const head = sorted.slice(0, 4).join('; ');
  return sorted.length > 4 ? `${head}; +${sorted.length - 4} more` : head;
}

function clip(s: string, n = 120): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
}

function canon(node: ts.Node | undefined, sf: ts.SourceFile): string {
  if (!node) return '';
  return printer.printNode(ts.EmitHint.Unspecified, node, sf).replace(/\s+/g, ' ').trim();
}

function canonList(nodes: readonly ts.Node[] | undefined, sf: ts.SourceFile): string {
  return nodes ? nodes.map((n) => canon(n, sf)).join(', ') : '';
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!mods?.some((m) => m.kind === kind);
}

function isExported(node: ts.Node): boolean {
  return hasModifier(node, ts.SyntaxKind.ExportKeyword);
}

function fnSignature(
  node: ts.SignatureDeclarationBase,
  sf: ts.SourceFile,
): string {
  const tps = canonList(node.typeParameters, sf);
  const params = canonList(node.parameters, sf);
  const ret = canon(node.type, sf);
  const asyncMod = hasModifier(node, ts.SyntaxKind.AsyncKeyword) ? 'async ' : '';
  return `${asyncMod}${tps ? `<${tps}>` : ''}(${params})${ret ? `: ${ret}` : ''}`;
}

function entities(text: string, path: string): Map<string, Entity> {
  const kind = path.endsWith('x') ? ts.ScriptKind.TSX : path.match(/\.(c|m)?js$/) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const out = new Map<string, Entity>();
  const add = (e: Entity) => {
    let key = e.key;
    for (let i = 2; out.has(key); i++) key = `${e.key}#${i}`;
    out.set(key, { ...e, key });
  };
  const exportedNames = collectExportedNames(sf);

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const spec = canon(stmt.moduleSpecifier, sf);
      add({ key: `import ${spec}`, exported: false, signature: '', body: canon(stmt, sf) });
    } else if (ts.isExportDeclaration(stmt)) {
      const spec = stmt.moduleSpecifier ? canon(stmt.moduleSpecifier, sf) : 'local';
      const clause = stmt.exportClause && ts.isNamedExports(stmt.exportClause) ? stmt.exportClause.elements : undefined;
      if (clause) {
        for (const el of clause) {
          add({ key: `export ${el.name.text} from ${spec}`, exported: true, signature: canon(el, sf), body: '' });
        }
      } else {
        add({ key: `export * from ${spec}`, exported: true, signature: canon(stmt, sf), body: '' });
      }
    } else if (ts.isExportAssignment(stmt)) {
      addExpressionEntity('default', true, stmt.expression, sf, add);
    } else if (ts.isFunctionDeclaration(stmt)) {
      const name = stmt.name?.text ?? 'default';
      const exported = isExported(stmt) || exportedNames.has(name);
      add({ key: `function ${name}`, exported, signature: fnSignature(stmt, sf), body: canon(stmt.body, sf) });
    } else if (ts.isClassDeclaration(stmt)) {
      const name = stmt.name?.text ?? 'default';
      const exported = isExported(stmt) || exportedNames.has(name);
      const heritage = canonList(stmt.heritageClauses, sf);
      add({ key: `class ${name}`, exported, signature: `${canonList(stmt.typeParameters, sf)} ${heritage}`, body: '' });
      for (const m of stmt.members) addClassMember(name, exported, m, sf, add);
    } else if (ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt)) {
      const name = stmt.name.text;
      const exported = isExported(stmt) || exportedNames.has(name);
      add({ key: `type ${name}`, exported, signature: canon(stmt, sf).replace(/^export /, ''), body: '' });
    } else if (ts.isEnumDeclaration(stmt)) {
      const name = stmt.name.text;
      const exported = isExported(stmt) || exportedNames.has(name);
      for (const m of stmt.members) {
        add({ key: `enum ${name}.${canon(m.name, sf)}`, exported, signature: canon(m, sf), body: '' });
      }
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const names = ts.isIdentifier(decl.name) ? [decl.name.text] : [canon(decl.name, sf)];
        const name = names[0] ?? 'anon';
        const exported = isExported(stmt) || exportedNames.has(name);
        const typeText = canon(decl.type, sf);
        addExpressionEntity(name, exported, decl.initializer, sf, add, typeText);
      }
    } else if (ts.isModuleDeclaration(stmt)) {
      add({ key: `namespace ${canon(stmt.name, sf)}`, exported: isExported(stmt), signature: canon(stmt, sf), body: '' });
    } else {
      // Side-effecting top-level statement: identity is its own text, so a change shows
      // up as remove + add of non-exported entities (body-level).
      const textKey = canon(stmt, sf);
      add({ key: `stmt ${clip(textKey, 60)}`, exported: false, signature: '', body: textKey });
    }
  }
  return out;
}

function collectExportedNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const stmt of sf.statements) {
    if (ts.isExportDeclaration(stmt) && !stmt.moduleSpecifier && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) names.add((el.propertyName ?? el.name).text);
    }
    if (ts.isExportAssignment(stmt) && ts.isIdentifier(stmt.expression)) names.add(stmt.expression.text);
  }
  return names;
}

function addExpressionEntity(
  name: string,
  exported: boolean,
  init: ts.Expression | undefined,
  sf: ts.SourceFile,
  add: (e: Entity) => void,
  typeText = '',
): void {
  const expr = init ? unwrap(init) : undefined;
  if (expr && (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr))) {
    add({ key: `function ${name}`, exported, signature: `${typeText} ${fnSignature(expr, sf)}`.trim(), body: canon(expr.body, sf) });
    return;
  }
  if (expr && ts.isObjectLiteralExpression(expr)) {
    // Object literals (registries, tables, config) are diffed per property so that
    // concurrent additions are additive, not body changes.
    add({ key: `const ${name}`, exported, signature: typeText, body: '' });
    for (const prop of expr.properties) {
      const pname = prop.name ? canon(prop.name, sf) : canon(prop, sf);
      const value = ts.isPropertyAssignment(prop) ? canon(prop.initializer, sf) : canon(prop, sf);
      add({ key: `${name}.${pname}`, exported, signature: '', body: value });
    }
    return;
  }
  if (expr && ts.isArrayLiteralExpression(expr)) {
    add({ key: `const ${name}`, exported, signature: typeText, body: '' });
    expr.elements.forEach((el) => {
      const text = canon(el, sf);
      add({ key: `${name}[${clip(text, 40)}]`, exported, signature: '', body: text });
    });
    return;
  }
  add({ key: `const ${name}`, exported, signature: typeText, body: canon(expr, sf) });
}

function unwrap(e: ts.Expression): ts.Expression {
  let cur = e;
  while (ts.isAsExpression(cur) || ts.isSatisfiesExpression(cur) || ts.isParenthesizedExpression(cur) || ts.isTypeAssertionExpression(cur)) {
    cur = cur.expression;
  }
  return cur;
}

function addClassMember(cls: string, exported: boolean, m: ts.ClassElement, sf: ts.SourceFile, add: (e: Entity) => void): void {
  const isPrivate =
    hasModifier(m, ts.SyntaxKind.PrivateKeyword) || (m.name !== undefined && ts.isPrivateIdentifier(m.name));
  const visible = exported && !isPrivate;
  const name = m.name ? canon(m.name, sf) : ts.isConstructorDeclaration(m) ? 'constructor' : 'member';
  const key = `${cls}.${name}`;
  if (ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m)) {
    add({ key, exported: visible, signature: fnSignature(m, sf), body: canon(m.body, sf) });
  } else if (ts.isPropertyDeclaration(m)) {
    add({ key, exported: visible, signature: canon(m.type, sf), body: canon(m.initializer, sf) });
  } else {
    add({ key, exported: visible, signature: canon(m, sf), body: '' });
  }
}
