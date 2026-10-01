// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('GCD', () => {
  it('=GCD(5, 2)', async () => {
    expect(await evaluate('=GCD(5, 2)')).toBeCloseTo(1, 9);
  });
  it('=GCD(24, 36)', async () => {
    expect(await evaluate('=GCD(24, 36)')).toBeCloseTo(12, 7);
  });
  it('=GCD(7, 1)', async () => {
    expect(await evaluate('=GCD(7, 1)')).toBeCloseTo(1, 9);
  });
  it('=GCD(5, 0)', async () => {
    expect(await evaluate('=GCD(5, 0)')).toBeCloseTo(5, 8);
  });
  it('=GCD({12, 18}, 27)', async () => {
    expect(await evaluate('=GCD({12, 18}, 27)')).toBeCloseTo(3, 8);
  });
  it('=GCD(24.9, 36)', async () => {
    expect(await evaluate('=GCD(24.9, 36)')).toBeCloseTo(12, 7);
  });
  it('=GCD(-1, 2)', async () => {
    expect(await evaluate('=GCD(-1, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GCD("x", 2)', async () => {
    expect(await evaluate('=GCD("x", 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
