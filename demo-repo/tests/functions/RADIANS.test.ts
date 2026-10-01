// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RADIANS', () => {
  it('=RADIANS(270)', async () => {
    expect(await evaluate('=RADIANS(270)')).toBeCloseTo(4.71238898038469, 8);
  });
  it('=RADIANS(180)', async () => {
    expect(await evaluate('=RADIANS(180)')).toBeCloseTo(3.141592653589793, 8);
  });
  it('=RADIANS(-45)', async () => {
    expect(await evaluate('=RADIANS(-45)')).toBeCloseTo(-0.7853981633974483, 9);
  });
  it('=RADIANS(0)', async () => {
    expect(await evaluate('=RADIANS(0)')).toBeCloseTo(0, 9);
  });
  it('=RADIANS("x")', async () => {
    expect(await evaluate('=RADIANS("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
