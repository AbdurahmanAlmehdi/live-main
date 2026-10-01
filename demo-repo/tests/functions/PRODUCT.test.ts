// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PRODUCT', () => {
  it('=PRODUCT(5, 15, 30)', async () => {
    expect(await evaluate('=PRODUCT(5, 15, 30)')).toBeCloseTo(2250, 5);
  });
  it('=PRODUCT({5, 15, 30}, 2)', async () => {
    expect(await evaluate('=PRODUCT({5, 15, 30}, 2)')).toBeCloseTo(4500, 5);
  });
  it('=PRODUCT(2, "3")', async () => {
    expect(await evaluate('=PRODUCT(2, "3")')).toBeCloseTo(6, 8);
  });
  it('=PRODUCT({2, "x", TRUE}, 3)', async () => {
    expect(await evaluate('=PRODUCT({2, "x", TRUE}, 3)')).toBeCloseTo(6, 8);
  });
  it('=PRODUCT(-1.5, 2)', async () => {
    expect(await evaluate('=PRODUCT(-1.5, 2)')).toBeCloseTo(-3, 8);
  });
  it('=PRODUCT(2, "x")', async () => {
    expect(await evaluate('=PRODUCT(2, "x")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=PRODUCT(2, #N/A)', async () => {
    expect(await evaluate('=PRODUCT(2, #N/A)')).toMatchObject({ code: '#N/A' });
  });
});
