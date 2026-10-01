import { describe, expect, it } from 'vitest';
import { FormulaSyntaxError, tokenize } from '../../src/eval/lexer';

const types = (src: string) => tokenize(src).map((t) => t.type);

describe('tokenize', () => {
  it('reads numbers in all forms', () => {
    const values = tokenize('1 2.5 .5 1e3 2E-2 3.').filter((t) => t.type === 'number').map((t) => t.value);
    expect(values).toEqual([1, 2.5, 0.5, 1000, 0.02, 3]);
  });

  it('reads strings with doubled quotes', () => {
    const [token] = tokenize('"say ""hi"""');
    expect(token).toMatchObject({ type: 'string', text: 'say "hi"' });
  });

  it('reads error literals case-insensitively', () => {
    expect(tokenize('#N/A #div/0! #VALUE!').filter((t) => t.type === 'error').map((t) => t.text)).toEqual(['#N/A', '#DIV/0!', '#VALUE!']);
  });

  it('reads identifiers with dots and digits', () => {
    expect(tokenize('CEILING.MATH LOG10').filter((t) => t.type === 'ident').map((t) => t.text)).toEqual(['CEILING.MATH', 'LOG10']);
  });

  it('prefers two-character operators', () => {
    expect(tokenize('1<>2<=3>=4').filter((t) => t.type === 'op').map((t) => t.text)).toEqual(['<>', '<=', '>=']);
  });

  it('reads punctuation', () => {
    expect(types('({1,2;3})')).toEqual(['lparen', 'lbrace', 'number', 'comma', 'number', 'semicolon', 'number', 'rbrace', 'rparen', 'eof']);
  });

  it('rejects unterminated strings and unknown characters', () => {
    expect(() => tokenize('"abc')).toThrow(FormulaSyntaxError);
    expect(() => tokenize('1 @ 2')).toThrow(FormulaSyntaxError);
    expect(() => tokenize('#FOO')).toThrow(FormulaSyntaxError);
  });
});
