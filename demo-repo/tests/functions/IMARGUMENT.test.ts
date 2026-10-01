// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IMARGUMENT', () => {
  it('=IMARGUMENT("3+4i")', async () => {
    expect(await evaluate('=IMARGUMENT("3+4i")')).toBeCloseTo(0.9272952180016122, 9);
  });
  it('=IMARGUMENT("-1")', async () => {
    expect(await evaluate('=IMARGUMENT("-1")')).toBeCloseTo(3.141592653589793, 8);
  });
  it('=IMARGUMENT("-i")', async () => {
    expect(await evaluate('=IMARGUMENT("-i")')).toBeCloseTo(-1.5707963267948966, 8);
  });
  it('=IMARGUMENT("-1-i")', async () => {
    expect(await evaluate('=IMARGUMENT("-1-i")')).toBeCloseTo(-2.356194490192345, 8);
  });
  it('=IMARGUMENT("2j")', async () => {
    expect(await evaluate('=IMARGUMENT("2j")')).toBeCloseTo(1.5707963267948966, 8);
  });
  it('=IMARGUMENT("0")', async () => {
    expect(await evaluate('=IMARGUMENT("0")')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=IMARGUMENT("abc")', async () => {
    expect(await evaluate('=IMARGUMENT("abc")')).toMatchObject({ code: '#NUM!' });
  });
});
