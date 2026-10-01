// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NPV', () => {
  it('=NPV(0.1, -10000, 3000, 4200, 6800)', async () => {
    expect(await evaluate('=NPV(0.1, -10000, 3000, 4200, 6800)')).toBeCloseTo(1188.4434123352207, 5);
  });
  it('=NPV(0.08, {8000, 9200, 10000, 12000, 14500}) - 40000', async () => {
    expect(await evaluate('=NPV(0.08, {8000, 9200, 10000, 12000, 14500}) - 40000')).toBeCloseTo(1922.061554932363, 5);
  });
  it('=NPV(0.08, {8000, 9200, 10000, 12000, 14500}, -9000)', async () => {
    expect(await evaluate('=NPV(0.08, {8000, 9200, 10000, 12000, 14500}, -9000)')).toBeCloseTo(36250.534912984425, 4);
  });
  it('=NPV(0, 1, 2, 3)', async () => {
    expect(await evaluate('=NPV(0, 1, 2, 3)')).toBeCloseTo(6, 8);
  });
  it('=NPV(0.05, {100, "x", TRUE, 200})', async () => {
    expect(await evaluate('=NPV(0.05, {100, "x", TRUE, 200})')).toBeCloseTo(276.6439909297052, 6);
  });
  it('=NPV(0.05, "100", 200)', async () => {
    expect(await evaluate('=NPV(0.05, "100", 200)')).toBeCloseTo(276.6439909297052, 6);
  });
  it('=NPV(0.1, 100, #N/A)', async () => {
    expect(await evaluate('=NPV(0.1, 100, #N/A)')).toMatchObject({ code: '#N/A' });
  });
  it('=NPV("x", 100)', async () => {
    expect(await evaluate('=NPV("x", 100)')).toMatchObject({ code: '#VALUE!' });
  });
});
