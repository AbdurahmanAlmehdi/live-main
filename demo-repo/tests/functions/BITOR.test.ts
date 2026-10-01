// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BITOR', () => {
  it('=BITOR(23, 10)', async () => {
    expect(await evaluate('=BITOR(23, 10)')).toBeCloseTo(31, 7);
  });
  it('=BITOR(0, 0)', async () => {
    expect(await evaluate('=BITOR(0, 0)')).toBeCloseTo(0, 9);
  });
  it('=BITOR(4294967296, 1)', async () => {
    expect(await evaluate('=BITOR(4294967296, 1)')).toBeCloseTo(4294967297, -1);
  });
  it('=BITOR(140737488355328, 140737488355327)', async () => {
    expect(await evaluate('=BITOR(140737488355328, 140737488355327)')).toBeCloseTo(281474976710655, -6);
  });
  it('=BITOR(2.5, 1)', async () => {
    expect(await evaluate('=BITOR(2.5, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITOR(-2, 1)', async () => {
    expect(await evaluate('=BITOR(-2, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITOR("x", 1)', async () => {
    expect(await evaluate('=BITOR("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
