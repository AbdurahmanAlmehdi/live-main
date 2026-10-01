// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LOGNORM.DIST', () => {
  it('=LOGNORM.DIST(4, 3.5, 1.2, TRUE)', async () => {
    expect(await evaluate('=LOGNORM.DIST(4, 3.5, 1.2, TRUE)')).toBeCloseTo(0.0390835557068005, 9);
  });
  it('=LOGNORM.DIST(4, 3.5, 1.2, FALSE)', async () => {
    expect(await evaluate('=LOGNORM.DIST(4, 3.5, 1.2, FALSE)')).toBeCloseTo(0.01761759668181924, 9);
  });
  it('=LOGNORM.DIST(1, 0, 1, TRUE)', async () => {
    expect(await evaluate('=LOGNORM.DIST(1, 0, 1, TRUE)')).toBeCloseTo(0.5, 9);
  });
  it('=LOGNORM.DIST(2, 0, 0.5, FALSE)', async () => {
    expect(await evaluate('=LOGNORM.DIST(2, 0, 0.5, FALSE)')).toBeCloseTo(0.15261382604754575, 9);
  });
  it('=LOGNORM.DIST(0, 0, 1, TRUE)', async () => {
    expect(await evaluate('=LOGNORM.DIST(0, 0, 1, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LOGNORM.DIST(1, 0, 0, TRUE)', async () => {
    expect(await evaluate('=LOGNORM.DIST(1, 0, 0, TRUE)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LOGNORM.DIST("x", 0, 1, TRUE)', async () => {
    expect(await evaluate('=LOGNORM.DIST("x", 0, 1, TRUE)')).toMatchObject({ code: '#VALUE!' });
  });
});
