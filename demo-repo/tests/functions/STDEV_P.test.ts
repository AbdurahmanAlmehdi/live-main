// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('STDEV.P', () => {
  it('=STDEV.P(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)', async () => {
    expect(await evaluate('=STDEV.P(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)')).toBeCloseTo(26.054558142482477, 7);
  });
  it('=STDEV.P({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=STDEV.P({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(1.4177446878757827, 8);
  });
  it('=STDEV.P({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=STDEV.P({1, "a", TRUE}, 3)')).toBeCloseTo(1, 9);
  });
  it('=STDEV.P(2, 4)', async () => {
    expect(await evaluate('=STDEV.P(2, 4)')).toBeCloseTo(1, 9);
  });
  it('=STDEV.P(5)', async () => {
    expect(await evaluate('=STDEV.P(5)')).toBeCloseTo(0, 9);
  });
  it('=STDEV.P({"a"})', async () => {
    expect(await evaluate('=STDEV.P({"a"})')).toMatchObject({ code: '#DIV/0!' });
  });
});
