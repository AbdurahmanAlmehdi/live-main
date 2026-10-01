// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CUMIPMT', () => {
  it('=CUMIPMT(0.09/12, 30*12, 125000, 13, 24, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0.09/12, 30*12, 125000, 13, 24, 0)')).toBeCloseTo(-11135.232130750845, 4);
  });
  it('=CUMIPMT(0.09/12, 30*12, 125000, 1, 1, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0.09/12, 30*12, 125000, 1, 1, 0)')).toBeCloseTo(-937.5, 6);
  });
  it('=CUMIPMT(0.1, 5, 1000, 1, 5, 1)', async () => {
    expect(await evaluate('=CUMIPMT(0.1, 5, 1000, 1, 5, 1)')).toBeCloseTo(-199.07945815793366, 6);
  });
  it('=CUMIPMT(0.05, 10, 5000, 3, 7, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0.05, 10, 5000, 3, 7, 0)')).toBeCloseTo(-815.9016603780552, 6);
  });
  it('=CUMIPMT(0, 10, 1000, 1, 2, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0, 10, 1000, 1, 2, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMIPMT(0.1, 10, -1000, 1, 2, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0.1, 10, -1000, 1, 2, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMIPMT(0.1, 10, 1000, 3, 2, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0.1, 10, 1000, 3, 2, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMIPMT(0.1, 10, 1000, 1, 11, 0)', async () => {
    expect(await evaluate('=CUMIPMT(0.1, 10, 1000, 1, 11, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMIPMT(0.1, 10, 1000, 1, 2, 2)', async () => {
    expect(await evaluate('=CUMIPMT(0.1, 10, 1000, 1, 2, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=CUMIPMT("x", 10, 1000, 1, 2, 0)', async () => {
    expect(await evaluate('=CUMIPMT("x", 10, 1000, 1, 2, 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
