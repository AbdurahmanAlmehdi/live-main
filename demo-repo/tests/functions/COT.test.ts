// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COT', () => {
  it('=COT(30)', async () => {
    expect(await evaluate('=COT(30)')).toBeCloseTo(-0.15611995216165922, 9);
  });
  it('=COT(1)', async () => {
    expect(await evaluate('=COT(1)')).toBeCloseTo(0.6420926159343306, 9);
  });
  it('=COT(-0.5)', async () => {
    expect(await evaluate('=COT(-0.5)')).toBeCloseTo(-1.830487721712452, 8);
  });
  it('=COT(0)', async () => {
    expect(await evaluate('=COT(0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=COT("x")', async () => {
    expect(await evaluate('=COT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
