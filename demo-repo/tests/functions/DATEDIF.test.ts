// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DATEDIF', () => {
  it('=DATEDIF(DATE(2001, 1, 1), DATE(2003, 1, 1), "Y")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 1, 1), DATE(2003, 1, 1), "Y")')).toBeCloseTo(2, 8);
  });
  it('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "M")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "M")')).toBeCloseTo(14, 7);
  });
  it('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "D")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "D")')).toBeCloseTo(440, 6);
  });
  it('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "MD")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "MD")')).toBeCloseTo(14, 7);
  });
  it('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YM")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YM")')).toBeCloseTo(2, 8);
  });
  it('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YD")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 6, 1), DATE(2002, 8, 15), "YD")')).toBeCloseTo(75, 7);
  });
  it('=DATEDIF(DATE(2002, 1, 1), DATE(2001, 1, 1), "Y")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2002, 1, 1), DATE(2001, 1, 1), "Y")')).toMatchObject({ code: '#NUM!' });
  });
  it('=DATEDIF(DATE(2001, 1, 1), DATE(2002, 1, 1), "Q")', async () => {
    expect(await evaluate('=DATEDIF(DATE(2001, 1, 1), DATE(2002, 1, 1), "Q")')).toMatchObject({ code: '#NUM!' });
  });
});
