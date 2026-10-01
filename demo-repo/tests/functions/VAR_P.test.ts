// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('VAR.P', () => {
  it('=VAR.P(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)', async () => {
    expect(await evaluate('=VAR.P(1345, 1301, 1368, 1322, 1310, 1370, 1318, 1350, 1303, 1299)')).toBeCloseTo(678.8399999999999, 6);
  });
  it('=VAR.P({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=VAR.P({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(2.0100000000000002, 8);
  });
  it('=VAR.P({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=VAR.P({1, "a", TRUE}, 3)')).toBeCloseTo(1, 9);
  });
  it('=VAR.P(2, 4)', async () => {
    expect(await evaluate('=VAR.P(2, 4)')).toBeCloseTo(1, 9);
  });
  it('=VAR.P(5)', async () => {
    expect(await evaluate('=VAR.P(5)')).toBeCloseTo(0, 9);
  });
  it('=VAR.P({"a"})', async () => {
    expect(await evaluate('=VAR.P({"a"})')).toMatchObject({ code: '#DIV/0!' });
  });
});
