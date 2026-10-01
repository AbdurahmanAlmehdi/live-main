// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BITLSHIFT', () => {
  it('=BITLSHIFT(4, 2)', async () => {
    expect(await evaluate('=BITLSHIFT(4, 2)')).toBeCloseTo(16, 7);
  });
  it('=BITLSHIFT(13, -2)', async () => {
    expect(await evaluate('=BITLSHIFT(13, -2)')).toBeCloseTo(3, 8);
  });
  it('=BITLSHIFT(1, 47)', async () => {
    expect(await evaluate('=BITLSHIFT(1, 47)')).toBeCloseTo(140737488355328, -6);
  });
  it('=BITLSHIFT(1, 48)', async () => {
    expect(await evaluate('=BITLSHIFT(1, 48)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITLSHIFT(5, 0)', async () => {
    expect(await evaluate('=BITLSHIFT(5, 0)')).toBeCloseTo(5, 8);
  });
  it('=BITLSHIFT(1, 54)', async () => {
    expect(await evaluate('=BITLSHIFT(1, 54)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITLSHIFT(-1, 1)', async () => {
    expect(await evaluate('=BITLSHIFT(-1, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITLSHIFT("x", 1)', async () => {
    expect(await evaluate('=BITLSHIFT("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
