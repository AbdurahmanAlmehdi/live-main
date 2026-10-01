// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COSH', () => {
  it('=COSH(4)', async () => {
    expect(await evaluate('=COSH(4)')).toBeCloseTo(27.308232836016487, 7);
  });
  it('=COSH(0)', async () => {
    expect(await evaluate('=COSH(0)')).toBeCloseTo(1, 9);
  });
  it('=COSH(-1.5)', async () => {
    expect(await evaluate('=COSH(-1.5)')).toBeCloseTo(2.352409615243247, 8);
  });
  it('=COSH(1000)', async () => {
    expect(await evaluate('=COSH(1000)')).toMatchObject({ code: '#NUM!' });
  });
  it('=COSH("x")', async () => {
    expect(await evaluate('=COSH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
