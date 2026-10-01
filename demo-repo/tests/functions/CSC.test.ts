// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CSC', () => {
  it('=CSC(15)', async () => {
    expect(await evaluate('=CSC(15)')).toBeCloseTo(1.5377805615408537, 8);
  });
  it('=CSC(1)', async () => {
    expect(await evaluate('=CSC(1)')).toBeCloseTo(1.1883951057781212, 8);
  });
  it('=CSC(-2)', async () => {
    expect(await evaluate('=CSC(-2)')).toBeCloseTo(-1.0997501702946164, 8);
  });
  it('=CSC(0)', async () => {
    expect(await evaluate('=CSC(0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=CSC("x")', async () => {
    expect(await evaluate('=CSC("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
