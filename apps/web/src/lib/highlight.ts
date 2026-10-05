/**
 * A small TypeScript/JavaScript highlighter for the code and diff views: keywords, strings,
 * comments, numbers, types (Capitalized) and calls, as escaped HTML with the design
 * system's tk-* classes. Line-at-a-time (block comments are coloured per line).
 */
const KEYWORDS = new Set(
  'abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface is keyof let new null of private protected public readonly return satisfies set static super switch this throw true try type typeof undefined var void while yield'.split(' '),
);

const TOKEN = /(\/\/.*$|\/\*.*?(?:\*\/|$)|^\s*\*.*$)|('(?:\\.|[^'\\])*'?|"(?:\\.|[^"\\])*"?|`(?:\\.|[^`\\])*`?)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_$][\w$]*)/g;

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightLine(line: string, lang: 'ts' | 'text' = 'ts'): string {
  if (lang === 'text') return escapeHtml(line);
  let out = '';
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    out += escapeHtml(line.slice(last, i));
    const [tok, comment, str, num, ident] = m;
    let cls = '';
    if (comment) cls = 'tk-c';
    else if (str) cls = 'tk-s';
    else if (num) cls = 'tk-n';
    else if (ident) {
      if (KEYWORDS.has(ident)) cls = 'tk-k';
      else if (/^[A-Z]/.test(ident)) cls = 'tk-t';
      else if (line[i + ident.length] === '(') cls = 'tk-f';
    }
    out += cls ? `<span class="${cls}">${escapeHtml(tok)}</span>` : escapeHtml(tok);
    last = i + tok.length;
  }
  return out + escapeHtml(line.slice(last));
}

export function langOf(path: string): 'ts' | 'text' {
  return /\.(m?[tj]sx?|vue|json)$/.test(path) ? 'ts' : 'text';
}
