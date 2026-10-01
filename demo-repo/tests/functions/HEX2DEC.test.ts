// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('HEX2DEC', () => {
  it('=HEX2DEC("A5")', async () => {
    expect(await evaluate('=HEX2DEC("A5")')).toBeCloseTo(165, 6);
  });
  it('=HEX2DEC("FFFFFFFF5B")', async () => {
    expect(await evaluate('=HEX2DEC("FFFFFFFF5B")')).toBeCloseTo(-165, 6);
  });
  it('=HEX2DEC("3DA408B9")', async () => {
    expect(await evaluate('=HEX2DEC("3DA408B9")')).toBeCloseTo(1034160313, -1);
  });
  it('=HEX2DEC("ff")', async () => {
    expect(await evaluate('=HEX2DEC("ff")')).toBeCloseTo(255, 6);
  });
  it('=HEX2DEC(100)', async () => {
    expect(await evaluate('=HEX2DEC(100)')).toBeCloseTo(256, 6);
  });
  it('=HEX2DEC("8000000000")', async () => {
    expect(await evaluate('=HEX2DEC("8000000000")')).toBeCloseTo(-549755813888, -3);
  });
  it('=HEX2DEC("FFFFFFFFFFF")', async () => {
    expect(await evaluate('=HEX2DEC("FFFFFFFFFFF")')).toMatchObject({ code: '#NUM!' });
  });
  it('=HEX2DEC("G1")', async () => {
    expect(await evaluate('=HEX2DEC("G1")')).toMatchObject({ code: '#NUM!' });
  });
});
