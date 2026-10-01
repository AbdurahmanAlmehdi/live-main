// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NOMINAL', () => {
  it('=NOMINAL(0.053543, 4)', async () => {
    expect(await evaluate('=NOMINAL(0.053543, 4)')).toBeCloseTo(0.052500319868356016, 9);
  });
  it('=NOMINAL(0.1, 12)', async () => {
    expect(await evaluate('=NOMINAL(0.1, 12)')).toBeCloseTo(0.09568968514684517, 9);
  });
  it('=NOMINAL(0.1, 1)', async () => {
    expect(await evaluate('=NOMINAL(0.1, 1)')).toBeCloseTo(0.10000000000000009, 9);
  });
  it('=NOMINAL(0.1, 4.9)', async () => {
    expect(await evaluate('=NOMINAL(0.1, 4.9)')).toBeCloseTo(0.09645475633778045, 9);
  });
  it('=NOMINAL(0, 4)', async () => {
    expect(await evaluate('=NOMINAL(0, 4)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NOMINAL(0.1, 0.5)', async () => {
    expect(await evaluate('=NOMINAL(0.1, 0.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=NOMINAL("x", 4)', async () => {
    expect(await evaluate('=NOMINAL("x", 4)')).toMatchObject({ code: '#VALUE!' });
  });
});
