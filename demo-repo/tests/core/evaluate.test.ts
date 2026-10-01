import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';
import { toMatrix, type Value } from '../../src/core/value';
import type { FormulaFunction, FunctionLoader } from '../../src/core/types';

const fn = (f: FormulaFunction): FunctionLoader => () => Promise.resolve({ default: f });

const testRegistry: Record<string, FunctionLoader> = {
  TWICE: fn({ minArgs: 1, maxArgs: 1, call: ([v]) => (typeof v === 'number' ? v * 2 : v) }),
  ARGCOUNT: fn({ minArgs: 0, maxArgs: Infinity, call: (args) => args.length }),
  ECHO: fn({ minArgs: 1, maxArgs: 1, call: ([v]) => v }),
  'DOT.NAME': fn({ minArgs: 0, maxArgs: 0, call: () => 'dot' }),
};

const run = (formula: string): Promise<Value> => evaluate(formula, { registry: testRegistry });

describe('evaluate: literals and arithmetic', () => {
  it('evaluates literals', async () => {
    expect(await run('=42')).toBe(42);
    expect(await run('="text"')).toBe('text');
    expect(await run('=TRUE')).toBe(true);
    expect(await run('=#N/A')).toMatchObject({ code: '#N/A' });
  });

  it('follows operator precedence', async () => {
    expect(await run('=1+2*3')).toBe(7);
    expect(await run('=(1+2)*3')).toBe(9);
    expect(await run('=2^3^2')).toBe(64);
    expect(await run('=-2^2')).toBe(4);
    expect(await run('=2*-3')).toBe(-6);
    expect(await run('=10-4-3')).toBe(3);
    expect(await run('=1+2&3')).toBe('33');
    expect(await run('=1+1=2')).toBe(true);
  });

  it('applies percent', async () => {
    expect(await run('=50%')).toBe(0.5);
    expect(await run('=200*10%')).toBeCloseTo(20, 9);
  });

  it('coerces text and booleans in arithmetic', async () => {
    expect(await run('="3"+TRUE')).toBe(4);
    expect(await run('=" 1,000 "*2')).toBe(2000);
    expect(await run('="abc"+1')).toMatchObject({ code: '#VALUE!' });
  });

  it('reports arithmetic errors', async () => {
    expect(await run('=1/0')).toMatchObject({ code: '#DIV/0!' });
    expect(await run('=0^0')).toMatchObject({ code: '#NUM!' });
    expect(await run('=(-8)^(1/3)')).toMatchObject({ code: '#NUM!' });
    expect(await run('=10^400')).toMatchObject({ code: '#NUM!' });
  });

  it('propagates the leftmost error', async () => {
    expect(await run('=#N/A+#DIV/0!')).toMatchObject({ code: '#N/A' });
    expect(await run('=1+#REF!')).toMatchObject({ code: '#REF!' });
  });

  it('concatenates with &', async () => {
    expect(await run('="a"&1.5&TRUE')).toBe('a1.5TRUE');
    expect(await run('=0.1+0.2&""')).toBe('0.3');
  });
});

describe('evaluate: comparison', () => {
  it('compares numbers, text and booleans', async () => {
    expect(await run('=1<2')).toBe(true);
    expect(await run('="a"="A"')).toBe(true);
    expect(await run('="b">"a"')).toBe(true);
    expect(await run('=1<"a"')).toBe(true);
    expect(await run('="z"<TRUE')).toBe(true);
    expect(await run('=FALSE<TRUE')).toBe(true);
    expect(await run('=1<>1')).toBe(false);
    expect(await run('="1"=1')).toBe(false);
  });
});

describe('evaluate: arrays', () => {
  it('evaluates array literals', async () => {
    expect(toMatrix(await run('={1,2;3,4}'))).toEqual([[1, 2], [3, 4]]);
  });

  it('broadcasts operators over arrays', async () => {
    expect(toMatrix(await run('={1,2,3}*2'))).toEqual([[2, 4, 6]]);
    expect(toMatrix(await run('={1;2}+{10,20}'))).toEqual([[11, 21], [12, 22]]);
    expect(toMatrix(await run('=-{1,2}'))).toEqual([[-1, -2]]);
  });

  it('fills mismatched shapes with #N/A', async () => {
    const m = toMatrix(await run('={1,2,3}+{1,2}'));
    expect(m[0].slice(0, 2)).toEqual([2, 4]);
    expect(m[0][2]).toMatchObject({ code: '#N/A' });
  });
});

describe('evaluate: functions', () => {
  it('calls registered functions by case-insensitive name', async () => {
    expect(await run('=twice(21)')).toBe(42);
    expect(await run('=TWICE(TWICE(2))+1')).toBe(9);
    expect(await run('=DOT.NAME()')).toBe('dot');
  });

  it('passes missing arguments as empty values', async () => {
    expect(await run('=ARGCOUNT(1,,3)')).toBe(3);
    expect(await run('=ECHO(,)')).toMatchObject({ code: '#N/A' });
    expect(await run('=ARGCOUNT()')).toBe(0);
  });

  it('passes error arguments through to the function', async () => {
    expect(await run('=ECHO(#NUM!)')).toMatchObject({ code: '#NUM!' });
  });

  it('returns #NAME? for unknown functions and names', async () => {
    expect(await run('=NOPE(1)')).toMatchObject({ code: '#NAME?' });
    expect(await run('=foo+1')).toMatchObject({ code: '#NAME?' });
    expect(await run('=HASOWNPROPERTY(1)')).toMatchObject({ code: '#NAME?' });
  });

  it('returns #N/A for a wrong number of arguments', async () => {
    expect(await run('=TWICE()')).toMatchObject({ code: '#N/A' });
    expect(await run('=TWICE(1,2)')).toMatchObject({ code: '#N/A' });
  });

  it('resolves names through the default registry when none is given', async () => {
    expect(await evaluate('=NO.SUCH.FUNCTION(1,2)')).toMatchObject({ code: '#NAME?' });
  });
});
