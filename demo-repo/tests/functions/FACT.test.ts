// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FACT', () => {
  it('=FACT(5)', async () => {
    expect(await evaluate('=FACT(5)')).toBeCloseTo(120, 6);
  });
  it('=FACT(1.9)', async () => {
    expect(await evaluate('=FACT(1.9)')).toBeCloseTo(1, 9);
  });
  it('=FACT(0)', async () => {
    expect(await evaluate('=FACT(0)')).toBeCloseTo(1, 9);
  });
  it('=FACT(20)', async () => {
    expect(await evaluate('=FACT(20)')).toBeCloseTo(2432902008176640000, -10);
  });
  it('=FACT(-1)', async () => {
    expect(await evaluate('=FACT(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=FACT(171)', async () => {
    expect(await evaluate('=FACT(171)')).toMatchObject({ code: '#NUM!' });
  });
  it('=FACT("x")', async () => {
    expect(await evaluate('=FACT("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
