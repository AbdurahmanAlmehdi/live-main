// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DELTA', () => {
  it('=DELTA(5, 4)', async () => {
    expect(await evaluate('=DELTA(5, 4)')).toBeCloseTo(0, 9);
  });
  it('=DELTA(5, 5)', async () => {
    expect(await evaluate('=DELTA(5, 5)')).toBeCloseTo(1, 9);
  });
  it('=DELTA(0.5, 0)', async () => {
    expect(await evaluate('=DELTA(0.5, 0)')).toBeCloseTo(0, 9);
  });
  it('=DELTA(0)', async () => {
    expect(await evaluate('=DELTA(0)')).toBeCloseTo(1, 9);
  });
  it('=DELTA("3", 3)', async () => {
    expect(await evaluate('=DELTA("3", 3)')).toBeCloseTo(1, 9);
  });
  it('=DELTA(-1.5, -1.5)', async () => {
    expect(await evaluate('=DELTA(-1.5, -1.5)')).toBeCloseTo(1, 9);
  });
  it('=DELTA("x", 1)', async () => {
    expect(await evaluate('=DELTA("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
