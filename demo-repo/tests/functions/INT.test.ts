// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('INT', () => {
  it('=INT(8.9)', async () => {
    expect(await evaluate('=INT(8.9)')).toBeCloseTo(8, 8);
  });
  it('=INT(-8.9)', async () => {
    expect(await evaluate('=INT(-8.9)')).toBeCloseTo(-9, 8);
  });
  it('=INT(-0.5)', async () => {
    expect(await evaluate('=INT(-0.5)')).toBeCloseTo(-1, 9);
  });
  it('=INT(5)', async () => {
    expect(await evaluate('=INT(5)')).toBeCloseTo(5, 8);
  });
  it('=INT("2.5")', async () => {
    expect(await evaluate('=INT("2.5")')).toBeCloseTo(2, 8);
  });
  it('=INT("x")', async () => {
    expect(await evaluate('=INT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
