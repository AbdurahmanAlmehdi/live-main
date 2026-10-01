// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('GESTEP', () => {
  it('=GESTEP(5, 4)', async () => {
    expect(await evaluate('=GESTEP(5, 4)')).toBeCloseTo(1, 9);
  });
  it('=GESTEP(5, 5)', async () => {
    expect(await evaluate('=GESTEP(5, 5)')).toBeCloseTo(1, 9);
  });
  it('=GESTEP(-4, -5)', async () => {
    expect(await evaluate('=GESTEP(-4, -5)')).toBeCloseTo(1, 9);
  });
  it('=GESTEP(-1)', async () => {
    expect(await evaluate('=GESTEP(-1)')).toBeCloseTo(0, 9);
  });
  it('=GESTEP(0)', async () => {
    expect(await evaluate('=GESTEP(0)')).toBeCloseTo(1, 9);
  });
  it('=GESTEP("2", 3)', async () => {
    expect(await evaluate('=GESTEP("2", 3)')).toBeCloseTo(0, 9);
  });
  it('=GESTEP("x")', async () => {
    expect(await evaluate('=GESTEP("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
