// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MROUND', () => {
  it('=MROUND(10, 3)', async () => {
    expect(await evaluate('=MROUND(10, 3)')).toBeCloseTo(9, 8);
  });
  it('=MROUND(-10, -3)', async () => {
    expect(await evaluate('=MROUND(-10, -3)')).toBeCloseTo(-9, 8);
  });
  it('=MROUND(1.3, 0.2)', async () => {
    expect(await evaluate('=MROUND(1.3, 0.2)')).toBeCloseTo(1.4000000000000001, 8);
  });
  it('=MROUND(7.5, 5)', async () => {
    expect(await evaluate('=MROUND(7.5, 5)')).toBeCloseTo(10, 8);
  });
  it('=MROUND(5, 0)', async () => {
    expect(await evaluate('=MROUND(5, 0)')).toBeCloseTo(0, 9);
  });
  it('=MROUND(5, -2)', async () => {
    expect(await evaluate('=MROUND(5, -2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=MROUND("x", 2)', async () => {
    expect(await evaluate('=MROUND("x", 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
