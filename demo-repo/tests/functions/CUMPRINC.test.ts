// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CUMPRINC', () => {
  it('=CUMPRINC(0.09/12, 30*12, 125000, 13, 24, 0)', async () => {
    expect(await evaluate('=CUMPRINC(0.09/12, 30*12, 125000, 13, 24, 0)')).toBeCloseTo(-934.1071234208781, 6);
  });
  it('=CUMPRINC(0.09/12, 30*12, 125000, 1, 1, 0)', async () => {
    expect(await evaluate('=CUMPRINC(0.09/12, 30*12, 125000, 1, 1, 0)')).toBeCloseTo(-68.27827118097684, 7);
  });
  it('=CUMPRINC(0.1, 5, 1000, 1, 5, 1)', async () => {
    expect(await evaluate('=CUMPRINC(0.1, 5, 1000, 1, 5, 1)')).toBeCloseTo(-999.9999999999989, 6);
  });
  it('=CUMPRINC(0.05, 10, 5000, 3, 7, 0)', async () => {
    expect(await evaluate('=CUMPRINC(0.05, 10, 5000, 3, 7, 0)')).toBeCloseTo(-2421.7127137583598, 5);
  });
  it('=CUMPRINC(0, 10, 1000, 1, 2, 0)', async () => {
    expect(await evaluate('=CUMPRINC(0, 10, 1000, 1, 2, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMPRINC(0.1, 10, 1000, 0, 2, 0)', async () => {
    expect(await evaluate('=CUMPRINC(0.1, 10, 1000, 0, 2, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMPRINC(0.1, 10, 1000, 1, 2, -1)', async () => {
    expect(await evaluate('=CUMPRINC(0.1, 10, 1000, 1, 2, -1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMPRINC("x", 10, 1000, 1, 2, 0)', async () => {
    expect(await evaluate('=CUMPRINC("x", 10, 1000, 1, 2, 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
