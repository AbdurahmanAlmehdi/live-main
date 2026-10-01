import { describe, expect, it } from 'vitest';
import { collectNumbers, flattenArgs, optionalBoolean, optionalInteger, optionalNumber, optionalText } from '../../src/core/args';
import { err } from '../../src/core/errors';
import { RangeValue } from '../../src/core/value';

const row = (...cells: (number | string | boolean | null)[]) => new RangeValue([cells]);

describe('flattenArgs', () => {
  it('expands ranges row by row and keeps scalars', () => {
    expect(flattenArgs([1, new RangeValue([[2, 'a'], [true, null]]), 'b'])).toEqual([1, 2, 'a', true, null, 'b']);
  });
});

describe('collectNumbers', () => {
  it('coerces direct arguments and ignores non-numbers inside ranges', () => {
    expect(collectNumbers([1, '2', true, row(3, 'x', false, null)])).toEqual([1, 2, 1, 3]);
  });

  it('counts empty direct arguments as zero by default', () => {
    expect(collectNumbers([1, null])).toEqual([1, 0]);
    expect(collectNumbers([1, null], { directEmpty: 'ignore' })).toEqual([1]);
  });

  it('returns #VALUE! for unparseable direct text unless ignored', () => {
    expect(collectNumbers([1, 'abc'])).toBe(err.value);
    expect(collectNumbers([1, 'abc'], { directText: 'ignore' })).toEqual([1]);
  });

  it('can ignore direct booleans', () => {
    expect(collectNumbers([true, 2], { directBooleans: 'ignore' })).toEqual([2]);
  });

  it('returns the first error, in ranges or direct', () => {
    expect(collectNumbers([1, new RangeValue([[err.num]]), err.na])).toBe(err.num);
    expect(collectNumbers([err.na, 1])).toBe(err.na);
  });
});

describe('optional arguments', () => {
  const args = [1.5, null, 'x', true];

  it('uses the fallback for omitted or empty arguments', () => {
    expect(optionalNumber(args, 1, 7)).toBe(7);
    expect(optionalNumber(args, 9, 7)).toBe(7);
    expect(optionalText(args, 1, 'd')).toBe('d');
    expect(optionalBoolean(args, 5, false)).toBe(false);
  });

  it('coerces present arguments', () => {
    expect(optionalNumber(args, 0, 7)).toBe(1.5);
    expect(optionalInteger(args, 0, 7)).toBe(1);
    expect(optionalNumber(args, 2, 7)).toBe(err.value);
    expect(optionalBoolean(args, 3, false)).toBe(true);
    expect(optionalText(args, 3, '')).toBe('TRUE');
  });
});
