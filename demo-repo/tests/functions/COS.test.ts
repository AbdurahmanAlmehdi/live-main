// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COS', () => {
  it('=COS(1.047)', async () => {
    expect(await evaluate('=COS(1.047)')).toBeCloseTo(0.5001710745970701, 9);
  });
  it('=COS(0)', async () => {
    expect(await evaluate('=COS(0)')).toBeCloseTo(1, 9);
  });
  it('=COS(PI())', async () => {
    expect(await evaluate('=COS(PI())')).toBeCloseTo(-1, 9);
  });
  it('=COS(-2)', async () => {
    expect(await evaluate('=COS(-2)')).toBeCloseTo(-0.4161468365471424, 9);
  });
  it('=COS("x")', async () => {
    expect(await evaluate('=COS("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
