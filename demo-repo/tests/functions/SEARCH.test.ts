// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SEARCH', () => {
  it('=SEARCH("e", "Statements", 6)', async () => {
    expect(await evaluate('=SEARCH("e", "Statements", 6)')).toBeCloseTo(7, 8);
  });
  it('=SEARCH("MARGIN", "Profit Margin")', async () => {
    expect(await evaluate('=SEARCH("MARGIN", "Profit Margin")')).toBeCloseTo(8, 8);
  });
  it('=SEARCH("m?r", "Profit Margin")', async () => {
    expect(await evaluate('=SEARCH("m?r", "Profit Margin")')).toBeCloseTo(8, 8);
  });
  it('=SEARCH("p*t", "Profit Margin")', async () => {
    expect(await evaluate('=SEARCH("p*t", "Profit Margin")')).toBeCloseTo(1, 9);
  });
  it('=SEARCH("~?", "Why?")', async () => {
    expect(await evaluate('=SEARCH("~?", "Why?")')).toBeCloseTo(4, 8);
  });
  it('=SEARCH("z", "abc")', async () => {
    expect(await evaluate('=SEARCH("z", "abc")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=SEARCH("a", "abc", 0)', async () => {
    expect(await evaluate('=SEARCH("a", "abc", 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
