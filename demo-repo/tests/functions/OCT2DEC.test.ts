// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('OCT2DEC', () => {
  it('=OCT2DEC("54")', async () => {
    expect(await evaluate('=OCT2DEC("54")')).toBeCloseTo(44, 7);
  });
  it('=OCT2DEC("7777777533")', async () => {
    expect(await evaluate('=OCT2DEC("7777777533")')).toBeCloseTo(-165, 6);
  });
  it('=OCT2DEC(777)', async () => {
    expect(await evaluate('=OCT2DEC(777)')).toBeCloseTo(511, 6);
  });
  it('=OCT2DEC("4000000000")', async () => {
    expect(await evaluate('=OCT2DEC("4000000000")')).toBeCloseTo(-536870912, 0);
  });
  it('=OCT2DEC("19")', async () => {
    expect(await evaluate('=OCT2DEC("19")')).toMatchObject({ code: '#NUM!' });
  });
  it('=OCT2DEC("12345670123")', async () => {
    expect(await evaluate('=OCT2DEC("12345670123")')).toMatchObject({ code: '#NUM!' });
  });
});
