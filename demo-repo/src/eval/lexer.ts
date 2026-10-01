import { ERROR_CODES, type ErrorCode } from '../core/value';

export type TokenType =
  | 'number'
  | 'string'
  | 'error'
  | 'ident'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'lbrace'
  | 'rbrace'
  | 'comma'
  | 'semicolon'
  | 'eof';

export interface Token {
  type: TokenType;
  /** Source text for idents/ops, decoded text for strings, the code for errors. */
  text: string;
  /** Parsed value for number tokens. */
  value?: number;
  /** Offset of the token in the formula. */
  pos: number;
}

export class FormulaSyntaxError extends Error {
  constructor(message: string, readonly pos: number) {
    super(`${message} (at offset ${pos})`);
    this.name = 'FormulaSyntaxError';
  }
}

const OPERATORS = ['<>', '<=', '>=', '+', '-', '*', '/', '^', '&', '%', '=', '<', '>'];
const PUNCTUATION: Record<string, TokenType> = {
  '(': 'lparen',
  ')': 'rparen',
  '{': 'lbrace',
  '}': 'rbrace',
  ',': 'comma',
  ';': 'semicolon',
};
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_.]*/;

/** Splits a formula (without the leading "=") into tokens. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < source.length) {
    const ch = source[pos];
    if (/\s/.test(ch)) {
      pos++;
      continue;
    }
    const rest = source.slice(pos);
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({ type: 'number', text: number[0], value: Number(number[0]), pos });
      pos += number[0].length;
      continue;
    }
    if (ch === '"') {
      const { text, end } = readString(source, pos);
      tokens.push({ type: 'string', text, pos });
      pos = end;
      continue;
    }
    if (ch === '#') {
      const code = ERROR_CODES.find((c) => rest.toUpperCase().startsWith(c));
      if (!code) throw new FormulaSyntaxError('unknown error literal', pos);
      tokens.push({ type: 'error', text: code satisfies ErrorCode, pos });
      pos += code.length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      tokens.push({ type: 'ident', text: ident[0], pos });
      pos += ident[0].length;
      continue;
    }
    const op = OPERATORS.find((o) => rest.startsWith(o));
    if (op) {
      tokens.push({ type: 'op', text: op, pos });
      pos += op.length;
      continue;
    }
    const punct = PUNCTUATION[ch];
    if (punct) {
      tokens.push({ type: punct, text: ch, pos });
      pos++;
      continue;
    }
    throw new FormulaSyntaxError(`unexpected character '${ch}'`, pos);
  }
  tokens.push({ type: 'eof', text: '', pos });
  return tokens;
}

/** Reads a "..." string starting at `start`; "" inside the string is an escaped quote. */
function readString(source: string, start: number): { text: string; end: number } {
  let text = '';
  let pos = start + 1;
  while (pos < source.length) {
    const ch = source[pos];
    if (ch === '"') {
      if (source[pos + 1] === '"') {
        text += '"';
        pos += 2;
        continue;
      }
      return { text, end: pos + 1 };
    }
    text += ch;
    pos++;
  }
  throw new FormulaSyntaxError('unterminated string', start);
}
