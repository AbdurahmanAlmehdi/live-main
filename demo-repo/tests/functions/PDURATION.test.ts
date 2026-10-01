// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PDURATION', () => {
  it('=PDURATION(0.025, 2000, 2200)', async () => {
    expect(await evaluate('=PDURATION(0.025, 2000, 2200)')).toBeCloseTo(3.859866162622655, 8);
  });
  it('=PDURATION(0.025/12, 1000, 1200)', async () => {
    expect(await evaluate('=PDURATION(0.025/12, 1000, 1200)')).toBeCloseTo(87.6054764193714, 7);
  });
  it('=PDURATION(0.1, 100, 50)', async () => {
    expect(await evaluate('=PDURATION(0.1, 100, 50)')).toBeCloseTo(-7.272540897341719, 8);
  });
  it('=PDURATION(0, 100, 200)', async () => {
    expect(await evaluate('=PDURATION(0, 100, 200)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PDURATION(0.1, -100, 200)', async () => {
    expect(await evaluate('=PDURATION(0.1, -100, 200)')).toMatchObject({ code: '#NUM!' });
  });
  it('=PDURATION("x", 100, 200)', async () => {
    expect(await evaluate('=PDURATION("x", 100, 200)')).toMatchObject({ code: '#VALUE!' });
  });
});
