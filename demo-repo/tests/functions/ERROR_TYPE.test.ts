// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ERROR.TYPE', () => {
  it('=ERROR.TYPE(#NULL!)', async () => {
    expect(await evaluate('=ERROR.TYPE(#NULL!)')).toBeCloseTo(1, 9);
  });
  it('=ERROR.TYPE(1/0)', async () => {
    expect(await evaluate('=ERROR.TYPE(1/0)')).toBeCloseTo(2, 8);
  });
  it('=ERROR.TYPE(#VALUE!)', async () => {
    expect(await evaluate('=ERROR.TYPE(#VALUE!)')).toBeCloseTo(3, 8);
  });
  it('=ERROR.TYPE(#REF!)', async () => {
    expect(await evaluate('=ERROR.TYPE(#REF!)')).toBeCloseTo(4, 8);
  });
  it('=ERROR.TYPE(#NAME?)', async () => {
    expect(await evaluate('=ERROR.TYPE(#NAME?)')).toBeCloseTo(5, 8);
  });
  it('=ERROR.TYPE(#NUM!)', async () => {
    expect(await evaluate('=ERROR.TYPE(#NUM!)')).toBeCloseTo(6, 8);
  });
  it('=ERROR.TYPE(#N/A)', async () => {
    expect(await evaluate('=ERROR.TYPE(#N/A)')).toBeCloseTo(7, 8);
  });
  it('=ERROR.TYPE(1)', async () => {
    expect(await evaluate('=ERROR.TYPE(1)')).toMatchObject({ code: '#N/A' });
  });
});
