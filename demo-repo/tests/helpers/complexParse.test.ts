import { describe, expect, it } from 'vitest';
import { parseComplex } from '../../src/helpers/complexParse';

describe('parseComplex', () => {
  it('parses full complex numbers', () => {
    expect(parseComplex('3+4i')).toEqual({ re: 3, im: 4, suffix: 'i' });
    expect(parseComplex('-2.5-0.5j')).toEqual({ re: -2.5, im: -0.5, suffix: 'j' });
    expect(parseComplex('1e2+1E-1i')).toEqual({ re: 100, im: 0.1, suffix: 'i' });
  });

  it('parses pure real and pure imaginary numbers', () => {
    expect(parseComplex(7)).toEqual({ re: 7, im: 0, suffix: 'i' });
    expect(parseComplex('7')).toEqual({ re: 7, im: 0, suffix: 'i' });
    expect(parseComplex('4i')).toEqual({ re: 0, im: 4, suffix: 'i' });
    expect(parseComplex('-j')).toEqual({ re: 0, im: -1, suffix: 'j' });
    expect(parseComplex('2+i')).toEqual({ re: 2, im: 1, suffix: 'i' });
  });

  it('rejects malformed text and booleans', () => {
    expect(parseComplex('3+4k')).toMatchObject({ code: '#NUM!' });
    expect(parseComplex('abc')).toMatchObject({ code: '#NUM!' });
    expect(parseComplex('i3')).toMatchObject({ code: '#NUM!' });
    expect(parseComplex(true)).toMatchObject({ code: '#VALUE!' });
  });
});
