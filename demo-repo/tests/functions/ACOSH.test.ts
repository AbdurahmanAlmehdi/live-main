// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ACOSH', () => {
  it('=ACOSH(1)', async () => {
    expect(await evaluate('=ACOSH(1)')).toBeCloseTo(0, 9);
  });
  it('=ACOSH(10)', async () => {
    expect(await evaluate('=ACOSH(10)')).toBeCloseTo(2.993222846126381, 8);
  });
  it('=ACOSH(2.5)', async () => {
    expect(await evaluate('=ACOSH(2.5)')).toBeCloseTo(1.566799236972411, 8);
  });
  it('=ACOSH(0.5)', async () => {
    expect(await evaluate('=ACOSH(0.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=ACOSH("x")', async () => {
    expect(await evaluate('=ACOSH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
