// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('WEEKDAY', () => {
  it('=WEEKDAY(43845)', async () => {
    expect(await evaluate('=WEEKDAY(43845)')).toBeCloseTo(4, 8);
  });
  it('=WEEKDAY(43845, 2)', async () => {
    expect(await evaluate('=WEEKDAY(43845, 2)')).toBeCloseTo(3, 8);
  });
  it('=WEEKDAY(43845, 3)', async () => {
    expect(await evaluate('=WEEKDAY(43845, 3)')).toBeCloseTo(2, 8);
  });
  it('=WEEKDAY(43845, 11)', async () => {
    expect(await evaluate('=WEEKDAY(43845, 11)')).toBeCloseTo(3, 8);
  });
  it('=WEEKDAY(43845, 16)', async () => {
    expect(await evaluate('=WEEKDAY(43845, 16)')).toBeCloseTo(5, 8);
  });
  it('=WEEKDAY(43842)', async () => {
    expect(await evaluate('=WEEKDAY(43842)')).toBeCloseTo(1, 9);
  });
  it('=WEEKDAY(43845, 4)', async () => {
    expect(await evaluate('=WEEKDAY(43845, 4)')).toMatchObject({ code: '#NUM!' });
  });
  it('=WEEKDAY(-1)', async () => {
    expect(await evaluate('=WEEKDAY(-1)')).toMatchObject({ code: '#NUM!' });
  });
});
