// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SIGN', () => {
  it('=SIGN(10)', async () => {
    expect(await evaluate('=SIGN(10)')).toBeCloseTo(1, 9);
  });
  it('=SIGN(4-4)', async () => {
    expect(await evaluate('=SIGN(4-4)')).toBeCloseTo(0, 9);
  });
  it('=SIGN(-0.00001)', async () => {
    expect(await evaluate('=SIGN(-0.00001)')).toBeCloseTo(-1, 9);
  });
  it('=SIGN("-3")', async () => {
    expect(await evaluate('=SIGN("-3")')).toBeCloseTo(-1, 9);
  });
  it('=SIGN("x")', async () => {
    expect(await evaluate('=SIGN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
