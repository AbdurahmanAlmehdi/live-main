// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LCM', () => {
  it('=LCM(5, 2)', async () => {
    expect(await evaluate('=LCM(5, 2)')).toBeCloseTo(10, 8);
  });
  it('=LCM(24, 36)', async () => {
    expect(await evaluate('=LCM(24, 36)')).toBeCloseTo(72, 7);
  });
  it('=LCM(3, 0)', async () => {
    expect(await evaluate('=LCM(3, 0)')).toBeCloseTo(0, 9);
  });
  it('=LCM({2, 3}, 4)', async () => {
    expect(await evaluate('=LCM({2, 3}, 4)')).toBeCloseTo(12, 7);
  });
  it('=LCM(4.9, 6)', async () => {
    expect(await evaluate('=LCM(4.9, 6)')).toBeCloseTo(12, 7);
  });
  it('=LCM(-1, 2)', async () => {
    expect(await evaluate('=LCM(-1, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LCM("x", 2)', async () => {
    expect(await evaluate('=LCM("x", 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
