// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SQRT', () => {
  it('=SQRT(16)', async () => {
    expect(await evaluate('=SQRT(16)')).toBeCloseTo(4, 8);
  });
  it('=SQRT(2)', async () => {
    expect(await evaluate('=SQRT(2)')).toBeCloseTo(1.4142135623730951, 8);
  });
  it('=SQRT(0)', async () => {
    expect(await evaluate('=SQRT(0)')).toBeCloseTo(0, 9);
  });
  it('=SQRT(0.25)', async () => {
    expect(await evaluate('=SQRT(0.25)')).toBeCloseTo(0.5, 9);
  });
  it('=SQRT(-16)', async () => {
    expect(await evaluate('=SQRT(-16)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SQRT("x")', async () => {
    expect(await evaluate('=SQRT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
