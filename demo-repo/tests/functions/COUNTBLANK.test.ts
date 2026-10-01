// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COUNTBLANK', () => {
  it('=COUNTBLANK({1, "", "a", ""})', async () => {
    expect(await evaluate('=COUNTBLANK({1, "", "a", ""})')).toBeCloseTo(2, 8);
  });
  it('=COUNTBLANK({1, 2})', async () => {
    expect(await evaluate('=COUNTBLANK({1, 2})')).toBeCloseTo(0, 9);
  });
  it('=COUNTBLANK("")', async () => {
    expect(await evaluate('=COUNTBLANK("")')).toBeCloseTo(1, 9);
  });
  it('=COUNTBLANK(5)', async () => {
    expect(await evaluate('=COUNTBLANK(5)')).toBeCloseTo(0, 9);
  });
});
