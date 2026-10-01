// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SUMX2PY2', () => {
  it('=SUMX2PY2({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})', async () => {
    expect(await evaluate('=SUMX2PY2({2, 3, 9, 1, 8, 7, 5}, {6, 5, 11, 7, 5, 4, 4})')).toBeCloseTo(521, 6);
  });
  it('=SUMX2PY2({1, 2}, {3, 4})', async () => {
    expect(await evaluate('=SUMX2PY2({1, 2}, {3, 4})')).toBeCloseTo(30, 7);
  });
  it('=SUMX2PY2({1, TRUE, 3}, {1, 2, 3})', async () => {
    expect(await evaluate('=SUMX2PY2({1, TRUE, 3}, {1, 2, 3})')).toBeCloseTo(20, 7);
  });
  it('=SUMX2PY2(5, 3)', async () => {
    expect(await evaluate('=SUMX2PY2(5, 3)')).toBeCloseTo(34, 7);
  });
  it('=SUMX2PY2({1, 2}, {1, 2, 3})', async () => {
    expect(await evaluate('=SUMX2PY2({1, 2}, {1, 2, 3})')).toMatchObject({ code: '#N/A' });
  });
});
