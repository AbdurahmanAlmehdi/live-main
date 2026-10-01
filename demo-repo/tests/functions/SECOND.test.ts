// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SECOND', () => {
  it('=SECOND(TIME(10, 25, 59))', async () => {
    expect(await evaluate('=SECOND(TIME(10, 25, 59))')).toBeCloseTo(59, 7);
  });
  it('=SECOND(0.5)', async () => {
    expect(await evaluate('=SECOND(0.5)')).toBeCloseTo(0, 9);
  });
  it('=SECOND(0.000115740740740741)', async () => {
    expect(await evaluate('=SECOND(0.000115740740740741)')).toBeCloseTo(10, 8);
  });
  it('=SECOND(43845.51)', async () => {
    expect(await evaluate('=SECOND(43845.51)')).toBeCloseTo(24, 7);
  });
  it('=SECOND(-1)', async () => {
    expect(await evaluate('=SECOND(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SECOND("x")', async () => {
    expect(await evaluate('=SECOND("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
