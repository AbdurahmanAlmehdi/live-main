import { NotImplementedError } from '../core/errors';

/**
 * Spreadsheet wildcard patterns: "*" matches any run of characters, "?" matches one
 * character, and "~" escapes the next character ("~*" is a literal asterisk).
 * Matching is case-insensitive and covers the whole text.
 */

/** True when the pattern contains an unescaped * or ?. */
export function hasWildcards(pattern: string): boolean {
  throw new NotImplementedError('hasWildcards (src/helpers/wildcard.ts)');
}

/** A case-insensitive RegExp that matches whole texts against the pattern. */
export function wildcardToRegExp(pattern: string): RegExp {
  throw new NotImplementedError('wildcardToRegExp (src/helpers/wildcard.ts)');
}
