// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DEC2OCT', () => {
  it('=DEC2OCT(58, 3)', async () => {
    expect(await evaluate('=DEC2OCT(58, 3)')).toBe('072');
  });
  it('=DEC2OCT(-100)', async () => {
    expect(await evaluate('=DEC2OCT(-100)')).toBe('7777777634');
  });
  it('=DEC2OCT(8)', async () => {
    expect(await evaluate('=DEC2OCT(8)')).toBe('10');
  });
  it('=DEC2OCT(536870911)', async () => {
    expect(await evaluate('=DEC2OCT(536870911)')).toBe('3777777777');
  });
  it('=DEC2OCT(536870912)', async () => {
    expect(await evaluate('=DEC2OCT(536870912)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2OCT(58, 1)', async () => {
    expect(await evaluate('=DEC2OCT(58, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2OCT("x")', async () => {
    expect(await evaluate('=DEC2OCT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
