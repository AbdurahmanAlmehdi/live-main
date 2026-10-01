// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FIXED', () => {
  it('=FIXED(1234.567, 1)', async () => {
    expect(await evaluate('=FIXED(1234.567, 1)')).toBe('1,234.6');
  });
  it('=FIXED(1234.567, -1)', async () => {
    expect(await evaluate('=FIXED(1234.567, -1)')).toBe('1,230');
  });
  it('=FIXED(-1234.567, -1, TRUE)', async () => {
    expect(await evaluate('=FIXED(-1234.567, -1, TRUE)')).toBe('-1230');
  });
  it('=FIXED(44.332)', async () => {
    expect(await evaluate('=FIXED(44.332)')).toBe('44.33');
  });
  it('=FIXED(1234567.891, 0)', async () => {
    expect(await evaluate('=FIXED(1234567.891, 0)')).toBe('1,234,568');
  });
  it('=FIXED("x")', async () => {
    expect(await evaluate('=FIXED("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
