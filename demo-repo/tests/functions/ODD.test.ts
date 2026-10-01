// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ODD', () => {
  it('=ODD(1.5)', async () => {
    expect(await evaluate('=ODD(1.5)')).toBeCloseTo(3, 8);
  });
  it('=ODD(3)', async () => {
    expect(await evaluate('=ODD(3)')).toBeCloseTo(3, 8);
  });
  it('=ODD(2)', async () => {
    expect(await evaluate('=ODD(2)')).toBeCloseTo(3, 8);
  });
  it('=ODD(-1)', async () => {
    expect(await evaluate('=ODD(-1)')).toBeCloseTo(-1, 9);
  });
  it('=ODD(-2)', async () => {
    expect(await evaluate('=ODD(-2)')).toBeCloseTo(-3, 8);
  });
  it('=ODD(0)', async () => {
    expect(await evaluate('=ODD(0)')).toBeCloseTo(1, 9);
  });
  it('=ODD("x")', async () => {
    expect(await evaluate('=ODD("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
