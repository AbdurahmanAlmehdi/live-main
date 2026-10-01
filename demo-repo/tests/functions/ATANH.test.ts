// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ATANH', () => {
  it('=ATANH(0.76159416)', async () => {
    expect(await evaluate('=ATANH(0.76159416)')).toBeCloseTo(1.0000000096297197, 8);
  });
  it('=ATANH(-0.1)', async () => {
    expect(await evaluate('=ATANH(-0.1)')).toBeCloseTo(-0.10033534773107562, 9);
  });
  it('=ATANH(0)', async () => {
    expect(await evaluate('=ATANH(0)')).toBeCloseTo(0, 9);
  });
  it('=ATANH(1)', async () => {
    expect(await evaluate('=ATANH(1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=ATANH("x")', async () => {
    expect(await evaluate('=ATANH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
