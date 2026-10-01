// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FACTDOUBLE', () => {
  it('=FACTDOUBLE(6)', async () => {
    expect(await evaluate('=FACTDOUBLE(6)')).toBeCloseTo(48, 7);
  });
  it('=FACTDOUBLE(7)', async () => {
    expect(await evaluate('=FACTDOUBLE(7)')).toBeCloseTo(105, 6);
  });
  it('=FACTDOUBLE(0)', async () => {
    expect(await evaluate('=FACTDOUBLE(0)')).toBeCloseTo(1, 9);
  });
  it('=FACTDOUBLE(7.9)', async () => {
    expect(await evaluate('=FACTDOUBLE(7.9)')).toBeCloseTo(105, 6);
  });
  it('=FACTDOUBLE(-1)', async () => {
    expect(await evaluate('=FACTDOUBLE(-1)')).toBeCloseTo(1, 9);
  });
  it('=FACTDOUBLE(-2)', async () => {
    expect(await evaluate('=FACTDOUBLE(-2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=FACTDOUBLE("x")', async () => {
    expect(await evaluate('=FACTDOUBLE("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
