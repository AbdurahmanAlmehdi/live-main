// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUBSTITUTE', () => {
  it('=SUBSTITUTE("Sales Data", "Sales", "Cost")', async () => {
    expect(await evaluate('=SUBSTITUTE("Sales Data", "Sales", "Cost")')).toBe('Cost Data');
  });
  it('=SUBSTITUTE("Quarter 1, 2008", "1", "2", 1)', async () => {
    expect(await evaluate('=SUBSTITUTE("Quarter 1, 2008", "1", "2", 1)')).toBe('Quarter 2, 2008');
  });
  it('=SUBSTITUTE("Quarter 1, 2011", "1", "2", 3)', async () => {
    expect(await evaluate('=SUBSTITUTE("Quarter 1, 2011", "1", "2", 3)')).toBe('Quarter 1, 2012');
  });
  it('=SUBSTITUTE("aaa", "a", "b")', async () => {
    expect(await evaluate('=SUBSTITUTE("aaa", "a", "b")')).toBe('bbb');
  });
  it('=SUBSTITUTE("abc", "", "x")', async () => {
    expect(await evaluate('=SUBSTITUTE("abc", "", "x")')).toBe('abc');
  });
  it('=SUBSTITUTE("abc", "b", "x", 5)', async () => {
    expect(await evaluate('=SUBSTITUTE("abc", "b", "x", 5)')).toBe('abc');
  });
  it('=SUBSTITUTE("abc", "b", "x", 0)', async () => {
    expect(await evaluate('=SUBSTITUTE("abc", "b", "x", 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
