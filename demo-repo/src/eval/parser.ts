import type { ErrorCode, Scalar } from '../core/value';
import { errorFromCode } from '../core/errors';
import { FormulaSyntaxError, tokenize, type Token } from './lexer';

export type BinaryOperator = '+' | '-' | '*' | '/' | '^' | '&' | '=' | '<>' | '<' | '>' | '<=' | '>=';

export type Node =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; code: ErrorCode }
  | { kind: 'array'; values: Scalar[][] }
  | { kind: 'missing' }
  | { kind: 'name'; name: string }
  | { kind: 'call'; name: string; args: Node[] }
  | { kind: 'unary'; op: '+' | '-'; operand: Node }
  | { kind: 'percent'; operand: Node }
  | { kind: 'binary'; op: BinaryOperator; left: Node; right: Node };

/**
 * Operator precedence, lowest first (Excel order). Negation binds tighter than
 * "^", so -2^2 is 4; all binary operators are left-associative.
 */
const BINARY_LEVELS: readonly (readonly BinaryOperator[])[] = [
  ['=', '<>', '<', '>', '<=', '>='],
  ['&'],
  ['+', '-'],
  ['*', '/'],
  ['^'],
];

/** Parses a formula such as "=SUM(1, 2) * 3" (the leading "=" is optional). */
export function parse(formula: string): Node {
  const source = formula.startsWith('=') ? formula.slice(1) : formula;
  const parser = new Parser(tokenize(source));
  const node = parser.parseExpression();
  parser.expect('eof');
  return node;
}

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.index];
  }

  private next(): Token {
    return this.tokens[this.index++];
  }

  private isOp(text: string): boolean {
    const token = this.peek();
    return token.type === 'op' && token.text === text;
  }

  expect(type: Token['type']): Token {
    const token = this.next();
    if (token.type !== type) {
      throw new FormulaSyntaxError(`expected ${type} but found ${token.type === 'eof' ? 'end of formula' : `'${token.text}'`}`, token.pos);
    }
    return token;
  }

  parseExpression(level = 0): Node {
    if (level === BINARY_LEVELS.length) return this.parsePercent();
    let left = this.parseExpression(level + 1);
    for (;;) {
      const token = this.peek();
      const op = BINARY_LEVELS[level].find((o) => token.type === 'op' && token.text === o);
      if (!op) return left;
      this.next();
      const right = this.parseExpression(level + 1);
      left = { kind: 'binary', op, left, right };
    }
  }

  private parsePercent(): Node {
    let operand = this.parseUnary();
    while (this.isOp('%')) {
      this.next();
      operand = { kind: 'percent', operand };
    }
    return operand;
  }

  private parseUnary(): Node {
    if (this.isOp('-') || this.isOp('+')) {
      const op = this.next().text as '+' | '-';
      return { kind: 'unary', op, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const token = this.next();
    switch (token.type) {
      case 'number':
        return { kind: 'number', value: token.value! };
      case 'string':
        return { kind: 'string', value: token.text };
      case 'error':
        return { kind: 'error', code: token.text as ErrorCode };
      case 'lparen': {
        const inner = this.parseExpression();
        this.expect('rparen');
        return inner;
      }
      case 'lbrace':
        return this.parseArray();
      case 'ident':
        return this.parseIdent(token);
      default:
        throw new FormulaSyntaxError(`unexpected ${token.type === 'eof' ? 'end of formula' : `'${token.text}'`}`, token.pos);
    }
  }

  private parseIdent(token: Token): Node {
    const upper = token.text.toUpperCase();
    if (this.peek().type === 'lparen') {
      this.next();
      return { kind: 'call', name: upper, args: this.parseArgs() };
    }
    if (upper === 'TRUE' || upper === 'FALSE') return { kind: 'boolean', value: upper === 'TRUE' };
    return { kind: 'name', name: token.text };
  }

  /** Arguments after "(", up to and including ")". Empty slots become 'missing'. */
  private parseArgs(): Node[] {
    const args: Node[] = [];
    if (this.peek().type === 'rparen') {
      this.next();
      return args;
    }
    for (;;) {
      const type = this.peek().type;
      args.push(type === 'comma' || type === 'rparen' ? { kind: 'missing' } : this.parseExpression());
      const separator = this.next();
      if (separator.type === 'rparen') return args;
      if (separator.type !== 'comma') {
        throw new FormulaSyntaxError(`expected ',' or ')' but found '${separator.text}'`, separator.pos);
      }
    }
  }

  /** An array literal after "{": constants only, "," between columns, ";" between rows. */
  private parseArray(): Node {
    const rows: Scalar[][] = [[]];
    for (;;) {
      rows[rows.length - 1].push(this.parseArrayConstant());
      const separator = this.next();
      if (separator.type === 'rbrace') break;
      if (separator.type === 'semicolon') rows.push([]);
      else if (separator.type !== 'comma') {
        throw new FormulaSyntaxError(`unexpected '${separator.text}' in array`, separator.pos);
      }
    }
    if (rows.some((row) => row.length !== rows[0].length)) {
      throw new FormulaSyntaxError('array rows must have the same number of columns', 0);
    }
    return { kind: 'array', values: rows };
  }

  private parseArrayConstant(): Scalar {
    let signed = false;
    let negative = false;
    while (this.isOp('-') || this.isOp('+')) {
      signed = true;
      if (this.next().text === '-') negative = !negative;
    }
    const token = this.next();
    if (token.type === 'number') return negative ? -token.value! : token.value!;
    if (!signed) {
      if (token.type === 'string') return token.text;
      if (token.type === 'error') return errorFromCode(token.text as ErrorCode);
      if (token.type === 'ident') {
        const upper = token.text.toUpperCase();
        if (upper === 'TRUE' || upper === 'FALSE') return upper === 'TRUE';
      }
    }
    throw new FormulaSyntaxError('array literals may only contain constants', token.pos);
  }
}
