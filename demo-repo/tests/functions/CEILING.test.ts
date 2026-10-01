// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CEILING', () => {
  it('=CEILING(2.5, 1)', async () => {
    expect(await evaluate('=CEILING(2.5, 1)')).toBeCloseTo(3, 8);
  });
  it('=CEILING(-2.5, -2)', async () => {
    expect(await evaluate('=CEILING(-2.5, -2)')).toBeCloseTo(-4, 8);
  });
  it('=CEILING(1.5, 0.1)', async () => {
    expect(await evaluate('=CEILING(1.5, 0.1)')).toBeCloseTo(1.5, 8);
  });
  it('=CEILING(0.234, 0.01)', async () => {
    expect(await evaluate('=CEILING(0.234, 0.01)')).toBeCloseTo(0.24, 9);
  });
  it('=CEILING(-2.5, 2)', async () => {
    expect(await evaluate('=CEILING(-2.5, 2)')).toBeCloseTo(-2, 8);
  });
  it('=CEILING(2.5, -2)', async () => {
    expect(await evaluate('=CEILING(2.5, -2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CEILING(0, 3)', async () => {
    expect(await evaluate('=CEILING(0, 3)')).toBeCloseTo(0, 9);
  });
  it('=CEILING(5, 0)', async () => {
    expect(await evaluate('=CEILING(5, 0)')).toBeCloseTo(0, 9);
  });
});
