// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TRUNC', () => {
  it('=TRUNC(8.9)', async () => {
    expect(await evaluate('=TRUNC(8.9)')).toBeCloseTo(8, 8);
  });
  it('=TRUNC(-8.9)', async () => {
    expect(await evaluate('=TRUNC(-8.9)')).toBeCloseTo(-8, 8);
  });
  it('=TRUNC(0.45)', async () => {
    expect(await evaluate('=TRUNC(0.45)')).toBeCloseTo(0, 9);
  });
  it('=TRUNC(3.14159, 2)', async () => {
    expect(await evaluate('=TRUNC(3.14159, 2)')).toBeCloseTo(3.14, 8);
  });
  it('=TRUNC(-3.14159, 3)', async () => {
    expect(await evaluate('=TRUNC(-3.14159, 3)')).toBeCloseTo(-3.141, 8);
  });
  it('=TRUNC(1234.567, -2)', async () => {
    expect(await evaluate('=TRUNC(1234.567, -2)')).toBeCloseTo(1200, 5);
  });
  it('=TRUNC(1234.567, -1.5)', async () => {
    expect(await evaluate('=TRUNC(1234.567, -1.5)')).toBeCloseTo(1230, 5);
  });
  it('=TRUNC("x")', async () => {
    expect(await evaluate('=TRUNC("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
