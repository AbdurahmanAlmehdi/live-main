// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COUNTA', () => {
  it('=COUNTA(1, "a", TRUE)', async () => {
    expect(await evaluate('=COUNTA(1, "a", TRUE)')).toBeCloseTo(3, 8);
  });
  it('=COUNTA({1, "", #N/A})', async () => {
    expect(await evaluate('=COUNTA({1, "", #N/A})')).toBeCloseTo(3, 8);
  });
  it('=COUNTA("")', async () => {
    expect(await evaluate('=COUNTA("")')).toBeCloseTo(1, 9);
  });
  it('=COUNTA({1, 2; 3, 4}, 5)', async () => {
    expect(await evaluate('=COUNTA({1, 2; 3, 4}, 5)')).toBeCloseTo(5, 8);
  });
  it('=COUNTA(#DIV/0!)', async () => {
    expect(await evaluate('=COUNTA(#DIV/0!)')).toBeCloseTo(1, 9);
  });
});
