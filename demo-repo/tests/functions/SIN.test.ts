// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SIN', () => {
  it('=SIN(PI())', async () => {
    expect(await evaluate('=SIN(PI())')).toBeCloseTo(1.2246467991473532e-16, 9);
  });
  it('=SIN(PI()/2)', async () => {
    expect(await evaluate('=SIN(PI()/2)')).toBeCloseTo(1, 9);
  });
  it('=SIN(30*PI()/180)', async () => {
    expect(await evaluate('=SIN(30*PI()/180)')).toBeCloseTo(0.49999999999999994, 9);
  });
  it('=SIN(-1)', async () => {
    expect(await evaluate('=SIN(-1)')).toBeCloseTo(-0.8414709848078965, 9);
  });
  it('=SIN("x")', async () => {
    expect(await evaluate('=SIN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
