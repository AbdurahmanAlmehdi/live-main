// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('AVERAGE', () => {
  it('=AVERAGE(10, 7, 9, 27, 2)', async () => {
    expect(await evaluate('=AVERAGE(10, 7, 9, 27, 2)')).toBeCloseTo(11, 7);
  });
  it('=AVERAGE({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=AVERAGE({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(4.3, 8);
  });
  it('=AVERAGE({1, "a", TRUE}, 3)', async () => {
    expect(await evaluate('=AVERAGE({1, "a", TRUE}, 3)')).toBeCloseTo(2, 8);
  });
  it('=AVERAGE("4", TRUE)', async () => {
    expect(await evaluate('=AVERAGE("4", TRUE)')).toBeCloseTo(2.5, 8);
  });
  it('=AVERAGE(-1.5, 2.5)', async () => {
    expect(await evaluate('=AVERAGE(-1.5, 2.5)')).toBeCloseTo(0.5, 9);
  });
  it('=AVERAGE({"a", "b"})', async () => {
    expect(await evaluate('=AVERAGE({"a", "b"})')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=AVERAGE(1, #N/A)', async () => {
    expect(await evaluate('=AVERAGE(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
