// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ASINH', () => {
  it('=ASINH(-2.5)', async () => {
    expect(await evaluate('=ASINH(-2.5)')).toBeCloseTo(-1.6472311463710965, 8);
  });
  it('=ASINH(10)', async () => {
    expect(await evaluate('=ASINH(10)')).toBeCloseTo(2.99822295029797, 8);
  });
  it('=ASINH(0)', async () => {
    expect(await evaluate('=ASINH(0)')).toBeCloseTo(0, 9);
  });
  it('=ASINH(1)', async () => {
    expect(await evaluate('=ASINH(1)')).toBeCloseTo(0.8813735870195429, 9);
  });
  it('=ASINH("x")', async () => {
    expect(await evaluate('=ASINH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
