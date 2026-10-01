// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('STDEV.S', () => {
  it('=STDEV.S(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)', async () => {
    expect(await evaluate('=STDEV.S(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)')).toBeCloseTo(27.46391571984349, 7);
  });
  it('=STDEV.S({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=STDEV.S({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(1.4944341180973264, 8);
  });
  it('=STDEV.S({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=STDEV.S({1, "a", TRUE}, 3)')).toBeCloseTo(1.4142135623730951, 8);
  });
  it('=STDEV.S(2, 4)', async () => {
    expect(await evaluate('=STDEV.S(2, 4)')).toBeCloseTo(1.4142135623730951, 8);
  });
  it('=STDEV.S(5)', async () => {
    expect(await evaluate('=STDEV.S(5)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=STDEV.S(1, #N/A)', async () => {
    expect(await evaluate('=STDEV.S(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
