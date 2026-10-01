// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TAN', () => {
  it('=TAN(0.785)', async () => {
    expect(await evaluate('=TAN(0.785)')).toBeCloseTo(0.9992039901050427, 9);
  });
  it('=TAN(45*PI()/180)', async () => {
    expect(await evaluate('=TAN(45*PI()/180)')).toBeCloseTo(0.9999999999999999, 9);
  });
  it('=TAN(0)', async () => {
    expect(await evaluate('=TAN(0)')).toBeCloseTo(0, 9);
  });
  it('=TAN(-1)', async () => {
    expect(await evaluate('=TAN(-1)')).toBeCloseTo(-1.5574077246549023, 8);
  });
  it('=TAN("x")', async () => {
    expect(await evaluate('=TAN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
