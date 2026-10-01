import { describe, expect, it } from 'vitest';
import { checkNumber, formatGeneral, parseNumber, toBoolean, toInteger, toNumber, toText } from '../../src/core/coerce';
import { err } from '../../src/core/errors';
import { RangeValue } from '../../src/core/value';

describe('toNumber', () => {
  it('converts scalars', () => {
    expect(toNumber(3)).toBe(3);
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(' 12 ')).toBe(12);
    expect(toNumber('abc')).toBe(err.value);
    expect(toNumber('')).toBe(err.value);
    expect(toNumber(err.na)).toBe(err.na);
  });

  it('unwraps 1x1 ranges only', () => {
    expect(toNumber(new RangeValue([[5]]))).toBe(5);
    expect(toNumber(new RangeValue([[1, 2]]))).toBe(err.value);
  });

  it('throws on values outside the model', () => {
    expect(() => toNumber(undefined as never)).toThrow(TypeError);
  });
});

describe('parseNumber', () => {
  it('parses spreadsheet number text', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('-$1,000')).toBe(-1000);
    expect(parseNumber('50%')).toBe(0.5);
    expect(parseNumber('1e3')).toBe(1000);
    expect(parseNumber('.5')).toBe(0.5);
  });

  it('rejects non-numbers', () => {
    for (const text of ['', ' ', 'abc', '1,00', '1.2.3', '.', '$', '%']) expect(parseNumber(text), text).toBeNull();
  });
});

describe('toInteger', () => {
  it('truncates toward zero', () => {
    expect(toInteger(2.7)).toBe(2);
    expect(toInteger(-2.7)).toBe(-2);
    expect(toInteger('3.9')).toBe(3);
    expect(toInteger('x')).toBe(err.value);
  });
});

describe('toText', () => {
  it('converts scalars', () => {
    expect(toText('a')).toBe('a');
    expect(toText(1.5)).toBe('1.5');
    expect(toText(true)).toBe('TRUE');
    expect(toText(null)).toBe('');
    expect(toText(err.div0)).toBe(err.div0);
  });
});

describe('formatGeneral', () => {
  it('uses at most 15 significant digits', () => {
    expect(formatGeneral(0.1 + 0.2)).toBe('0.3');
    expect(formatGeneral(1 / 3)).toBe('0.333333333333333');
    expect(formatGeneral(-0)).toBe('0');
    expect(formatGeneral(1e21)).toBe('1E+21');
    expect(formatGeneral(123)).toBe('123');
  });
});

describe('toBoolean', () => {
  it('converts scalars', () => {
    expect(toBoolean(0)).toBe(false);
    expect(toBoolean(-1)).toBe(true);
    expect(toBoolean(null)).toBe(false);
    expect(toBoolean('true')).toBe(true);
    expect(toBoolean('FALSE')).toBe(false);
    expect(toBoolean('yes')).toBe(err.value);
  });
});

describe('checkNumber', () => {
  it('maps non-finite numbers to #NUM!', () => {
    expect(checkNumber(NaN)).toBe(err.num);
    expect(checkNumber(Infinity)).toBe(err.num);
    expect(Object.is(checkNumber(-0), 0)).toBe(true);
    expect(checkNumber(2)).toBe(2);
  });
});
