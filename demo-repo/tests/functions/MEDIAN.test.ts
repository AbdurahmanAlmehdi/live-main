// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MEDIAN', () => {
  it('=MEDIAN(1, 2, 3, 4, 5)', async () => {
    expect(await evaluate('=MEDIAN(1, 2, 3, 4, 5)')).toBeCloseTo(3, 8);
  });
  it('=MEDIAN(1, 2, 3, 4, 5, 6)', async () => {
    expect(await evaluate('=MEDIAN(1, 2, 3, 4, 5, 6)')).toBeCloseTo(3.5, 8);
  });
  it('=MEDIAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})', async () => {
    expect(await evaluate('=MEDIAN({3, 4, 5, 2, 3, 4, 5, 6, 4, 7})')).toBeCloseTo(4, 8);
  });
  it('=MEDIAN({3, "a", TRUE}, 1)', async () => {
    expect(await evaluate('=MEDIAN({3, "a", TRUE}, 1)')).toBeCloseTo(2, 8);
  });
  it('=MEDIAN(7)', async () => {
    expect(await evaluate('=MEDIAN(7)')).toBeCloseTo(7, 8);
  });
  it('=MEDIAN({"a"})', async () => {
    expect(await evaluate('=MEDIAN({"a"})')).toMatchObject({ code: '#NUM!' });
  });
  it('=MEDIAN(1, #N/A)', async () => {
    expect(await evaluate('=MEDIAN(1, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
