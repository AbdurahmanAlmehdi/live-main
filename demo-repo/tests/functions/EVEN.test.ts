// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EVEN', () => {
  it('=EVEN(1.5)', async () => {
    expect(await evaluate('=EVEN(1.5)')).toBeCloseTo(2, 8);
  });
  it('=EVEN(3)', async () => {
    expect(await evaluate('=EVEN(3)')).toBeCloseTo(4, 8);
  });
  it('=EVEN(2)', async () => {
    expect(await evaluate('=EVEN(2)')).toBeCloseTo(2, 8);
  });
  it('=EVEN(-1)', async () => {
    expect(await evaluate('=EVEN(-1)')).toBeCloseTo(-2, 8);
  });
  it('=EVEN(0)', async () => {
    expect(await evaluate('=EVEN(0)')).toBeCloseTo(0, 9);
  });
  it('=EVEN(-2.5)', async () => {
    expect(await evaluate('=EVEN(-2.5)')).toBeCloseTo(-4, 8);
  });
  it('=EVEN("x")', async () => {
    expect(await evaluate('=EVEN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
