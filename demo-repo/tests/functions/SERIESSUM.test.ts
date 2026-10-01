// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SERIESSUM', () => {
  it('=SERIESSUM(PI()/4, 0, 2, {1, -0.5, 0.041666667, -0.001388889})', async () => {
    expect(await evaluate('=SERIESSUM(PI()/4, 0, 2, {1, -0.5, 0.041666667, -0.001388889})')).toBeCloseTo(0.7071032149236011, 9);
  });
  it('=SERIESSUM(2, 1, 1, {1, 1, 1})', async () => {
    expect(await evaluate('=SERIESSUM(2, 1, 1, {1, 1, 1})')).toBeCloseTo(14, 7);
  });
  it('=SERIESSUM(0.5, 0, 1, 3)', async () => {
    expect(await evaluate('=SERIESSUM(0.5, 0, 1, 3)')).toBeCloseTo(3, 8);
  });
  it('=SERIESSUM(1, 2, 3, {2, 4})', async () => {
    expect(await evaluate('=SERIESSUM(1, 2, 3, {2, 4})')).toBeCloseTo(6, 8);
  });
  it('=SERIESSUM("x", 0, 1, {1})', async () => {
    expect(await evaluate('=SERIESSUM("x", 0, 1, {1})')).toMatchObject({ code: '#VALUE!' });
  });
});
