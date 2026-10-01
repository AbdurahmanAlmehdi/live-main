// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NPER', () => {
  it('=NPER(0.12/12, -100, -1000, 10000, 1)', async () => {
    expect(await evaluate('=NPER(0.12/12, -100, -1000, 10000, 1)')).toBeCloseTo(59.67386567429457, 7);
  });
  it('=NPER(0.12/12, -100, -1000, 10000)', async () => {
    expect(await evaluate('=NPER(0.12/12, -100, -1000, 10000)')).toBeCloseTo(60.08212285376166, 7);
  });
  it('=NPER(0.12/12, -100, -1000)', async () => {
    expect(await evaluate('=NPER(0.12/12, -100, -1000)')).toBeCloseTo(-9.578594039813161, 8);
  });
  it('=NPER(0, -100, 1000)', async () => {
    expect(await evaluate('=NPER(0, -100, 1000)')).toBeCloseTo(10, 8);
  });
  it('=NPER(0.05, -500, 3000, 0, 1)', async () => {
    expect(await evaluate('=NPER(0.05, -500, 3000, 0, 1)')).toBeCloseTo(6.896312860369898, 8);
  });
  it('=NPER(0.1, 100, 1000)', async () => {
    expect(await evaluate('=NPER(0.1, 100, 1000)')).toBeCloseTo(-7.272540897341713, 8);
  });
  it('=NPER(0.1, -100, 2000)', async () => {
    expect(await evaluate('=NPER(0.1, -100, 2000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NPER("x", -100, 1000)', async () => {
    expect(await evaluate('=NPER("x", -100, 1000)')).toMatchObject({ code: '#VALUE!' });
  });
});
