// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ABS', () => {
  it('=ABS(-4.5)', async () => {
    expect(await evaluate('=ABS(-4.5)')).toBeCloseTo(4.5, 8);
  });
  it('=ABS(3)', async () => {
    expect(await evaluate('=ABS(3)')).toBeCloseTo(3, 8);
  });
  it('=ABS(0)', async () => {
    expect(await evaluate('=ABS(0)')).toBeCloseTo(0, 9);
  });
  it('=ABS("-2")', async () => {
    expect(await evaluate('=ABS("-2")')).toBeCloseTo(2, 8);
  });
  it('=ABS(TRUE)', async () => {
    expect(await evaluate('=ABS(TRUE)')).toBeCloseTo(1, 9);
  });
  it('=ABS("abc")', async () => {
    expect(await evaluate('=ABS("abc")')).toMatchObject({ code: '#VALUE!' });
  });
});
