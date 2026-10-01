// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('GAMMALN', () => {
  it('=GAMMALN(4)', async () => {
    expect(await evaluate('=GAMMALN(4)')).toBeCloseTo(1.791759469228055, 8);
  });
  it('=GAMMALN(0.5)', async () => {
    expect(await evaluate('=GAMMALN(0.5)')).toBeCloseTo(0.572364942924743, 9);
  });
  it('=GAMMALN(1)', async () => {
    expect(await evaluate('=GAMMALN(1)')).toBeCloseTo(0, 9);
  });
  it('=GAMMALN(100)', async () => {
    expect(await evaluate('=GAMMALN(100)')).toBeCloseTo(359.1342053696796, 6);
  });
  it('=GAMMALN(0.001)', async () => {
    expect(await evaluate('=GAMMALN(0.001)')).toBeCloseTo(6.907178885383853, 8);
  });
  it('=GAMMALN(0)', async () => {
    expect(await evaluate('=GAMMALN(0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMALN(-1.5)', async () => {
    expect(await evaluate('=GAMMALN(-1.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMALN("x")', async () => {
    expect(await evaluate('=GAMMALN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
