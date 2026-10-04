import { createTwoFilesPatch, diffArrays } from 'diff';
import type { ChangeClass, DiffLine, FilePatch, FileStat, Hunk } from '@livemain/protocol';

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/**
 * Parse a unified diff (git or jsdiff output) into typed file patches. `classes` supplies the
 * sigdiff change class per path (unknown paths count as body).
 */
export function parsePatch(patch: string, classes: Record<string, ChangeClass> = {}): FilePatch[] {
  const files: FilePatch[] = [];
  let file: FilePatch | null = null;
  let hunk: Hunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let oldPath: string | null = null;

  const startFile = (path: string) => {
    file = { path, class: classes[path] ?? 'body', added: 0, removed: 0, status: 'modified', hunks: [] };
    files.push(file);
    hunk = null;
  };

  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      startFile(m?.[2] ?? line.slice(11));
      oldPath = m?.[1] ?? null;
      continue;
    }
    if (line.startsWith('--- ')) {
      const p = line.slice(4).replace(/^a\//, '').replace(/\t.*$/, '');
      oldPath = p === '/dev/null' ? null : p;
      continue;
    }
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/^b\//, '').replace(/\t.*$/, '');
      if (!file) startFile(p === '/dev/null' ? (oldPath ?? p) : p);
      const f = file as FilePatch | null;
      if (f) {
        if (p === '/dev/null') {
          f.status = 'deleted';
          if (oldPath) f.path = oldPath;
        } else if (oldPath === null) f.status = 'added';
        f.class = classes[f.path] ?? f.class;
      }
      continue;
    }
    if (!file) continue;
    const current = file as FilePatch;
    if (line.startsWith('new file mode')) {
      current.status = 'added';
      continue;
    }
    if (line.startsWith('deleted file mode')) {
      current.status = 'deleted';
      continue;
    }
    if (line.startsWith('Binary files')) {
      current.binary = true;
      continue;
    }
    const m = HUNK.exec(line);
    if (m) {
      oldNo = Number(m[1]);
      newNo = Number(m[3]);
      hunk = { header: line, oldStart: oldNo, oldLines: m[2] === undefined ? 1 : Number(m[2]), newStart: newNo, newLines: m[4] === undefined ? 1 : Number(m[4]), lines: [] };
      current.hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    const h = hunk as Hunk;
    const tag = line[0];
    const text = line.slice(1);
    let dl: DiffLine | null = null;
    if (tag === '+') {
      dl = { kind: 'add', old: null, new: newNo++, text };
      current.added++;
    } else if (tag === '-') {
      dl = { kind: 'del', old: oldNo++, new: null, text };
      current.removed++;
    } else if (tag === ' ') dl = { kind: 'ctx', old: oldNo++, new: newNo++, text };
    if (dl) h.lines.push(dl);
  }
  return files;
}

/** A git-style unified patch for one file (null = absent), for hosts that cannot diff themselves. */
export function unifiedPatch(path: string, before: string | null, after: string | null, binary = false): string {
  const a = before === null ? '/dev/null' : `a/${path}`;
  const b = after === null ? '/dev/null' : `b/${path}`;
  const mode = before === null ? 'new file mode 100644\n' : after === null ? 'deleted file mode 100644\n' : '';
  const head = `diff --git a/${path} b/${path}\n${mode}`;
  if (binary) return `${head}Binary files ${a} and ${b} differ\n`;
  const body = createTwoFilesPatch(a, b, before ?? '', after ?? '', undefined, undefined, { context: 3 });
  // jsdiff opens with "Index:" and "====" lines; git does not.
  return head + body.split('\n').filter((l) => !l.startsWith('Index: ') && !l.startsWith('====')).join('\n');
}

/** Diff two versions of one file (null = absent). */
export function diffFile(path: string, before: string | null, after: string | null, cls: ChangeClass = 'body'): FilePatch {
  const parsed = parsePatch(unifiedPatch(path, before, after), { [path]: cls })[0] ?? { path, class: cls, added: 0, removed: 0, status: 'modified' as const, hunks: [] };
  parsed.path = path;
  parsed.status = before === null ? 'added' : after === null ? 'deleted' : 'modified';
  return parsed;
}

export function statOf(p: FilePatch): FileStat {
  return { path: p.path, class: p.class, added: p.added, removed: p.removed, status: p.status };
}

/** Lines of `s`, each keeping its trailing "\n" (the last may lack one). */
function splitLines(s: string): string[] {
  return s.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/** One side's edit relative to base: base lines [start, end) become `lines` (start === end inserts). */
interface Edit {
  start: number;
  end: number;
  lines: string[];
}

function editsOf(base: string[], side: string[]): Edit[] {
  const out: Edit[] = [];
  let at = 0;
  let cur: Edit | null = null;
  for (const c of diffArrays(base, side)) {
    if (!c.added && !c.removed) {
      if (cur) out.push(cur);
      cur = null;
      at += c.count;
      continue;
    }
    cur ??= { start: at, end: at, lines: [] };
    if (c.removed) cur.end = at += c.count;
    else cur.lines.push(...c.value);
  }
  if (cur) out.push(cur);
  return out;
}

const sameLines = (a: string[], b: string[]) => a.length === b.length && a.every((l, i) => l === b[i]);

/**
 * Line-based three-way merge, mirroring the workcell's clean cases (union of insertions at the same
 * anchor, ours first; non-overlapping edits from both sides). Returns null on a conflict.
 */
export function merge3(base: string, ours: string, theirs: string): string | null {
  if (ours === theirs || base === theirs) return ours;
  if (base === ours) return theirs;
  const b = splitLines(base);
  const o = editsOf(b, splitLines(ours));
  const t = editsOf(b, splitLines(theirs));
  const out: string[] = [];
  const emit = (lines: string[]) => {
    if (lines.length === 0) return;
    // A block that ended a file without a newline gets one when more follows.
    const n = out.length;
    if (n > 0 && !out[n - 1]!.endsWith('\n')) out[n - 1] += '\n';
    out.push(...lines);
  };
  let pos = 0;
  let i = 0;
  let j = 0;
  while (i < o.length || j < t.length) {
    const x = o[i];
    const y = t[j];
    let next: Edit;
    if (x && y && x.start === y.start && x.end === y.end) {
      if (sameLines(x.lines, y.lines)) next = x;
      else if (x.start === x.end) next = { ...x, lines: [...x.lines, ...y.lines] };
      else return null;
      i++;
      j++;
    } else if (x && (!y || x.end <= y.start)) {
      next = x;
      i++;
    } else if (y && (!x || y.end <= x.start)) {
      next = y;
      j++;
    } else return null;
    emit(b.slice(pos, next.start));
    emit(next.lines);
    pos = next.end;
  }
  emit(b.slice(pos));
  return out.join('');
}

/**
 * An agent's overlay change to one file, shown against current main. When main moved under the
 * agent (`head` differs from its pinned `pin`), the overlay's own edits are rebased onto main the way
 * promotion merges them, so concurrent landings don't read as removals; if they conflict, the patch
 * falls back to the overlay against its pin.
 */
export function overlayPatch(path: string, pin: string | null, head: string | null, overlay: string | null, cls: ChangeClass = 'body'): FilePatch {
  if (pin === head || overlay === null) return diffFile(path, head, overlay, cls);
  const merged = head === null ? null : merge3(pin ?? '', overlay, head);
  if (merged !== null) return { ...diffFile(path, head, merged, cls), against: 'rebased' };
  return { ...diffFile(path, pin, overlay, cls), against: 'pin' };
}
