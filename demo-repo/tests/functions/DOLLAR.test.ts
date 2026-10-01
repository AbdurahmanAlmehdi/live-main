// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DOLLAR', () => {
  it('=DOLLAR(1234.567)', async () => {
    expect(await evaluate('=DOLLAR(1234.567)')).toBe('$1,234.57');
  });
  it('=DOLLAR(1234.567, -2)', async () => {
    expect(await evaluate('=DOLLAR(1234.567, -2)')).toBe('$1,200');
  });
  it('=DOLLAR(0.123, 4)', async () => {
    expect(await evaluate('=DOLLAR(0.123, 4)')).toBe('$0.1230');
  });
  it('=DOLLAR(99.888, 1)', async () => {
    expect(await evaluate('=DOLLAR(99.888, 1)')).toBe('$99.9');
  });
  it('=DOLLAR(-1234.567, 2)', async () => {
    expect(await evaluate('=DOLLAR(-1234.567, 2)')).toBe('($1,234.57)');
  });
  it('=DOLLAR("x")', async () => {
    expect(await evaluate('=DOLLAR("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
