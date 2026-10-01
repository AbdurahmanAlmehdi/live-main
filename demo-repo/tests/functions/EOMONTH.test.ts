// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EOMONTH', () => {
  it('=EOMONTH(43845, 0)', async () => {
    expect(await evaluate('=EOMONTH(43845, 0)')).toBeCloseTo(43861, 4);
  });
  it('=EOMONTH(43845, 1)', async () => {
    expect(await evaluate('=EOMONTH(43845, 1)')).toBeCloseTo(43890, 4);
  });
  it('=EOMONTH(43845, -1)', async () => {
    expect(await evaluate('=EOMONTH(43845, -1)')).toBeCloseTo(43830, 4);
  });
  it('=EOMONTH(43890, 12)', async () => {
    expect(await evaluate('=EOMONTH(43890, 12)')).toBeCloseTo(44255, 4);
  });
  it('=EOMONTH(43845, 1.9)', async () => {
    expect(await evaluate('=EOMONTH(43845, 1.9)')).toBeCloseTo(43890, 4);
  });
  it('=EOMONTH(-1, 1)', async () => {
    expect(await evaluate('=EOMONTH(-1, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=EOMONTH("x", 1)', async () => {
    expect(await evaluate('=EOMONTH("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
