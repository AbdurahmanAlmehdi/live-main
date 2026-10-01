// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('POWER', () => {
  it('=POWER(5, 2)', async () => {
    expect(await evaluate('=POWER(5, 2)')).toBeCloseTo(25, 7);
  });
  it('=POWER(98.6, 3.2)', async () => {
    expect(await evaluate('=POWER(98.6, 3.2)')).toBeCloseTo(2401077.2220695773, 2);
  });
  it('=POWER(4, 5/4)', async () => {
    expect(await evaluate('=POWER(4, 5/4)')).toBeCloseTo(5.65685424949238, 8);
  });
  it('=POWER(2, -1)', async () => {
    expect(await evaluate('=POWER(2, -1)')).toBeCloseTo(0.5, 9);
  });
  it('=POWER(-8, 1/3)', async () => {
    expect(await evaluate('=POWER(-8, 1/3)')).toMatchObject({ code: '#NUM!' });
  });
  it('=POWER(0, 0)', async () => {
    expect(await evaluate('=POWER(0, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=POWER(0, -1)', async () => {
    expect(await evaluate('=POWER(0, -1)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=POWER("x", 2)', async () => {
    expect(await evaluate('=POWER("x", 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
