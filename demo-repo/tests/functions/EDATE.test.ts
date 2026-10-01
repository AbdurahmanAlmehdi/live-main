// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EDATE', () => {
  it('=EDATE(43845, 1)', async () => {
    expect(await evaluate('=EDATE(43845, 1)')).toBeCloseTo(43876, 4);
  });
  it('=EDATE(43845, -1)', async () => {
    expect(await evaluate('=EDATE(43845, -1)')).toBeCloseTo(43814, 4);
  });
  it('=EDATE(43861, 1)', async () => {
    expect(await evaluate('=EDATE(43861, 1)')).toBeCloseTo(43890, 4);
  });
  it('=EDATE(43845, 12)', async () => {
    expect(await evaluate('=EDATE(43845, 12)')).toBeCloseTo(44211, 4);
  });
  it('=EDATE(43845, 1.9)', async () => {
    expect(await evaluate('=EDATE(43845, 1.9)')).toBeCloseTo(43876, 4);
  });
  it('=EDATE(43845, -1.9)', async () => {
    expect(await evaluate('=EDATE(43845, -1.9)')).toBeCloseTo(43814, 4);
  });
  it('=EDATE("x", 1)', async () => {
    expect(await evaluate('=EDATE("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
