// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DEGREES', () => {
  it('=DEGREES(PI())', async () => {
    expect(await evaluate('=DEGREES(PI())')).toBeCloseTo(180, 6);
  });
  it('=DEGREES(1)', async () => {
    expect(await evaluate('=DEGREES(1)')).toBeCloseTo(57.29577951308232, 7);
  });
  it('=DEGREES(-0.5)', async () => {
    expect(await evaluate('=DEGREES(-0.5)')).toBeCloseTo(-28.64788975654116, 7);
  });
  it('=DEGREES(0)', async () => {
    expect(await evaluate('=DEGREES(0)')).toBeCloseTo(0, 9);
  });
  it('=DEGREES("x")', async () => {
    expect(await evaluate('=DEGREES("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
