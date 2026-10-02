/**
 * Path globs as used by policies: `**` matches across directories, `*` within one path
 * segment, `?` one character; a pattern ending in `/` covers everything under that directory.
 */
export function globMatcher(globs: string[]): (path: string) => boolean {
  const res = globs
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => (g.endsWith('/') ? `${g}**` : g))
    .map((g) => {
      let re = '';
      for (let i = 0; i < g.length; i++) {
        const c = g[i]!;
        if (c === '*' && g[i + 1] === '*') {
          re += g[i + 2] === '/' ? '(?:.*/)?' : '.*';
          i += g[i + 2] === '/' ? 2 : 1;
        } else if (c === '*') re += '[^/]*';
        else if (c === '?') re += '[^/]';
        else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
      }
      return new RegExp(`^${re}$`);
    });
  return (path) => res.some((re) => re.test(path));
}
