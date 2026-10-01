// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LOG10', () => {
  it('=LOG10(86)', async () => {
    expect(await evaluate('=LOG10(86)')).toBeCloseTo(1.9344984512435675, 8);
  });
  it('=LOG10(10)', async () => {
    expect(await evaluate('=LOG10(10)')).toBeCloseTo(1, 9);
  });
  it('=LOG10(100000)', async () => {
    expect(await evaluate('=LOG10(100000)')).toBeCloseTo(5, 8);
  });
  it('=LOG10(0.001)', async () => {
    expect(await evaluate('=LOG10(0.001)')).toBeCloseTo(-2.9999999999999996, 8);
  });
  it('=LOG10(0)', async () => {
    expect(await evaluate('=LOG10(0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LOG10("x")', async () => {
    expect(await evaluate('=LOG10("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
