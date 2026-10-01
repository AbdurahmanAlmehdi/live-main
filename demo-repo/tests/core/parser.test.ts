import { describe, expect, it } from 'vitest';
import { parse } from '../../src/eval/parser';
import { FormulaSyntaxError } from '../../src/eval/lexer';

describe('parse', () => {
  it('accepts an optional leading "="', () => {
    expect(parse('=1')).toEqual(parse('1'));
  });

  it('gives * higher precedence than +', () => {
    expect(parse('1+2*3')).toEqual({
      kind: 'binary', op: '+',
      left: { kind: 'number', value: 1 },
      right: { kind: 'binary', op: '*', left: { kind: 'number', value: 2 }, right: { kind: 'number', value: 3 } },
    });
  });

  it('binds negation tighter than ^', () => {
    expect(parse('-2^2')).toMatchObject({ kind: 'binary', op: '^', left: { kind: 'unary', op: '-' } });
  });

  it('parses function calls with missing arguments', () => {
    expect(parse('ROUND(1.5,)')).toEqual({ kind: 'call', name: 'ROUND', args: [{ kind: 'number', value: 1.5 }, { kind: 'missing' }] });
    expect(parse('PI()')).toEqual({ kind: 'call', name: 'PI', args: [] });
  });

  it('upper-cases function names and recognises booleans', () => {
    expect(parse('sum(true, False)')).toEqual({ kind: 'call', name: 'SUM', args: [{ kind: 'boolean', value: true }, { kind: 'boolean', value: false }] });
  });

  it('parses array literals with rows and signed numbers', () => {
    expect(parse('{1,-2;"a",TRUE}')).toEqual({ kind: 'array', values: [[1, -2], ['a', true]] });
  });

  it('parses percent as a postfix operator', () => {
    expect(parse('50%')).toEqual({ kind: 'percent', operand: { kind: 'number', value: 50 } });
  });

  it('treats bare identifiers as names', () => {
    expect(parse('foo')).toEqual({ kind: 'name', name: 'foo' });
  });

  it('rejects malformed formulas', () => {
    for (const bad of ['1+', '(1', 'SUM(1 2)', '{1,2;3}', '{1+1}', '1 2']) {
      expect(() => parse(bad), bad).toThrow(FormulaSyntaxError);
    }
  });
});
