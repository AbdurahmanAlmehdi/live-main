/**
 * Spreadsheet wildcard patterns: "*" matches any run of characters, "?" matches one
 * character, and "~" escapes the next character ("~*" is a literal asterisk).
 * Matching is case-insensitive and covers the whole text.
 */

/** True when the pattern contains an unescaped * or ?. */
export function hasWildcards(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~') i++;
    else if (ch === '*' || ch === '?') return true;
  }
  return false;
}

/** A case-insensitive RegExp that matches whole texts against the pattern. */
export function wildcardToRegExp(pattern: string): RegExp {
  let source = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '~' && i + 1 < pattern.length) {
      source += escapeRegExp(pattern[++i]);
    } else if (ch === '*') {
      source += '[\\s\\S]*';
    } else if (ch === '?') {
      source += '[\\s\\S]';
    } else {
      source += escapeRegExp(ch);
    }
  }
  return new RegExp(`^${source}$`, 'i');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
