// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RIGHT', () => {
  it('=RIGHT("Sale Price", 5)', async () => {
    expect(await evaluate('=RIGHT("Sale Price", 5)')).toBe('Price');
  });
  it('=RIGHT("Stock Number")', async () => {
    expect(await evaluate('=RIGHT("Stock Number")')).toBe('r');
  });
  it('=RIGHT("abc", 10)', async () => {
    expect(await evaluate('=RIGHT("abc", 10)')).toBe('abc');
  });
  it('=RIGHT("abc", 0)', async () => {
    expect(await evaluate('=RIGHT("abc", 0)')).toBe('');
  });
  it('=RIGHT(12345, 2)', async () => {
    expect(await evaluate('=RIGHT(12345, 2)')).toBe('45');
  });
  it('=RIGHT("abc", -1)', async () => {
    expect(await evaluate('=RIGHT("abc", -1)')).toMatchObject({ code: '#VALUE!' });
  });
});
