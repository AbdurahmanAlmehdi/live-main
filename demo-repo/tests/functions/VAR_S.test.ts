// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('VAR.S', () => {
  it('=VAR.S(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)', async () => {
    expect(await evaluate('=VAR.S(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)')).toBeCloseTo(754.2666666666665, 6);
  });
  it('=VAR.S({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=VAR.S({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(2.2333333333333334, 8);
  });
  it('=VAR.S({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=VAR.S({1, "a", TRUE}, 3)')).toBeCloseTo(2, 8);
  });
  it('=VAR.S(2, 4)', async () => {
    expect(await evaluate('=VAR.S(2, 4)')).toBeCloseTo(2, 8);
  });
  it('=VAR.S(5)', async () => {
    expect(await evaluate('=VAR.S(5)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=VAR.S(1, #N/A)', async () => {
    expect(await evaluate('=VAR.S(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
