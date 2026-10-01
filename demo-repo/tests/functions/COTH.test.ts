// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COTH', () => {
  it('=COTH(2)', async () => {
    expect(await evaluate('=COTH(2)')).toBeCloseTo(1.0373147207275482, 8);
  });
  it('=COTH(-0.5)', async () => {
    expect(await evaluate('=COTH(-0.5)')).toBeCloseTo(-2.163953413738653, 8);
  });
  it('=COTH(10)', async () => {
    expect(await evaluate('=COTH(10)')).toBeCloseTo(1.0000000041223072, 8);
  });
  it('=COTH(0)', async () => {
    expect(await evaluate('=COTH(0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=COTH("x")', async () => {
    expect(await evaluate('=COTH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
