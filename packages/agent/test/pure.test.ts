import { describe, expect, it } from 'vitest';
import { changedPaths } from '../src/strategies/git-baselines.js';
import { globToRegExp } from '../src/glob.js';
import { insertBefore, keepSide, pickVariant, unnumber } from '../src/scripted-agent.js';
import { renderNotices } from '../src/session.js';

describe('scripted agent helpers', () => {
  it('unnumber recovers content around notices', () => {
    const text = '[livemain] main moved under you:\n- REVIEW moved a.ts: x\n1\tconst a = 1;\n2\t\n3\texport { a };\n\n[livemain] more';
    expect(unnumber(text)).toBe('const a = 1;\n\nexport { a };\n');
  });

  it('insertBefore inserts at the start of the anchor line', () => {
    const reg = "export const registry = {\n  A: () => import('a'),\n  // functions (marker)\n};\n";
    expect(insertBefore(reg, '  // functions', "  B: () => import('b'),\n")).toBe(
      "export const registry = {\n  A: () => import('a'),\n  B: () => import('b'),\n  // functions (marker)\n};\n",
    );
    expect(insertBefore(reg, 'missing', 'x')).toBeNull();
  });

  it('keepSide handles diff3 and plain markers', () => {
    const c = 'a\n<<<<<<< HEAD\nmine\n||||||| base\nold\n=======\ntheirs\n>>>>>>> main\nz';
    expect(keepSide(c, 'first')).toBe('a\nmine\nz');
    expect(keepSide(c, 'second')).toBe('a\ntheirs\nz');
  });

  it('globToRegExp', () => {
    const re = globToRegExp('src/functions/**/*.ts');
    expect(re.test('src/functions/math/SUM.ts')).toBe(true);
    expect(re.test('src/functions/SUM.ts')).toBe(true);
    expect(re.test('src/core/value.ts')).toBe(false);
    expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false);
  });

  it('pickVariant prefers the most specific satisfied variant', () => {
    const sol = {
      taskId: 'fn-X',
      variants: [
        { requires: [], ops: [] },
        { requires: ['co-1'], ops: [{ op: 'delete' as const, path: 'a' }] },
        { requires: ['co-1', 'co-2'], ops: [{ op: 'delete' as const, path: 'b' }] },
      ],
    };
    expect(pickVariant(sol, new Set()).requires).toEqual([]);
    expect(pickVariant(sol, new Set(['co-1'])).requires).toEqual(['co-1']);
    expect(pickVariant(sol, new Set(['co-1', 'co-2'])).requires).toEqual(['co-1', 'co-2']);
    expect(pickVariant(sol, new Set(['co-2'])).requires).toEqual([]);
  });
});

describe('applyOps idempotence', () => {
  it('does not re-apply an edit whose new text extends the old text', async () => {
    const { applyOps } = await import('../src/scripted-agent.js');
    let file = 'export const a = 1;\n';
    const call = async (name: string, input: Record<string, unknown>) => {
      if (name === 'read_file') return { text: file.split('\n').slice(0, -1).map((l, i) => `${i + 1}\t${l}`).join('\n'), isError: false };
      if (name === 'edit_file') file = file.replace(String(input.old_string), String(input.new_string));
      return { text: 'ok', isError: false };
    };
    const ops = [{ op: 'edit' as const, path: 'x.ts', oldString: 'export const a = 1;', newString: 'export const a = 1;\nexport const b = 2;' }];
    await applyOps(ops, call);
    await applyOps(ops, call);
    expect(file).toBe('export const a = 1;\nexport const b = 2;\n');
  });

  it('inserts with an edit on the current file, so a base move after the read is kept', async () => {
    const { applyOps } = await import('../src/scripted-agent.js');
    let file = 'const r = {\n  A: 1,\n  // marker\n};\n';
    const call = async (name: string, input: Record<string, unknown>) => {
      if (name === 'read_file') {
        const text = file.split('\n').slice(0, -1).map((l, i) => `${i + 1}\t${l}`).join('\n');
        file = file.replace('  A: 1,\n', '  A: 1,\n  B: 2,\n'); // main moves (a checkpoint) right after the read
        return { text, isError: false };
      }
      if (name === 'edit_file') file = file.replace(String(input.old_string), String(input.new_string));
      if (name === 'write_file') file = String(input.content);
      return { text: 'ok', isError: false };
    };
    await applyOps([{ op: 'insertBefore' as const, path: 'r.ts', anchor: '  // marker', text: '  C: 3,\n' }], call);
    expect(file).toBe('const r = {\n  A: 1,\n  B: 2,\n  C: 3,\n  // marker\n};\n');
  });

  it('applies a deletion (empty newString) once', async () => {
    const { applyOps } = await import('../src/scripted-agent.js');
    let file = 'a\nb\nc\n';
    let edits = 0;
    const call = async (name: string, input: Record<string, unknown>) => {
      if (name === 'read_file') return { text: file.split('\n').slice(0, -1).map((l, i) => `${i + 1}\t${l}`).join('\n'), isError: false };
      if (name === 'edit_file') {
        edits++;
        file = file.replace(String(input.old_string), String(input.new_string));
      }
      return { text: 'ok', isError: false };
    };
    const ops = [{ op: 'edit' as const, path: 'x.ts', oldString: 'b\n', newString: '' }];
    await applyOps(ops, call);
    await applyOps(ops, call);
    expect(file).toBe('a\nc\n');
    expect(edits).toBe(1);
  });
});

describe('rendering', () => {
  it('orders notices by severity and tells the agent to re-check on interrupts', () => {
    const text = renderNotices([
      { severity: 'review', kind: 'moved', path: 'b.ts', reason: 'body changed' },
      { severity: 'interrupt', kind: 'read-write', path: 'a.ts', reason: 'signature changed', diff: '-a\n+b' },
    ]);
    expect(text.indexOf('a.ts')).toBeLessThan(text.indexOf('b.ts'));
    expect(text).toContain('INTERRUPT');
    expect(text).toContain('Re-check');
  });

  it('changedPaths parses git diff headers', () => {
    const diff = 'diff --git a/src/x.ts b/src/x.ts\nindex 1..2\n--- a/src/x.ts\n+++ b/src/x.ts\ndiff --git a/new.ts b/new.ts\n';
    expect(changedPaths(diff)).toEqual(['src/x.ts', 'new.ts']);
  });
});
