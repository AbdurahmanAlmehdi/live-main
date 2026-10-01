// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SINH', () => {
  it('=SINH(1)', async () => {
    expect(await evaluate('=SINH(1)')).toBeCloseTo(1.1752011936438014, 8);
  });
  it('=SINH(-1)', async () => {
    expect(await evaluate('=SINH(-1)')).toBeCloseTo(-1.1752011936438014, 8);
  });
  it('=SINH(0)', async () => {
    expect(await evaluate('=SINH(0)')).toBeCloseTo(0, 9);
  });
  it('=SINH(2.5)', async () => {
    expect(await evaluate('=SINH(2.5)')).toBeCloseTo(6.0502044810397875, 8);
  });
  it('=SINH(1000)', async () => {
    expect(await evaluate('=SINH(1000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SINH("x")', async () => {
    expect(await evaluate('=SINH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
