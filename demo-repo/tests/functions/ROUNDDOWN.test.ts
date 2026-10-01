// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ROUNDDOWN', () => {
  it('=ROUNDDOWN(3.2, 0)', async () => {
    expect(await evaluate('=ROUNDDOWN(3.2, 0)')).toBeCloseTo(3, 8);
  });
  it('=ROUNDDOWN(76.9, 0)', async () => {
    expect(await evaluate('=ROUNDDOWN(76.9, 0)')).toBeCloseTo(76, 7);
  });
  it('=ROUNDDOWN(3.14159, 3)', async () => {
    expect(await evaluate('=ROUNDDOWN(3.14159, 3)')).toBeCloseTo(3.141, 8);
  });
  it('=ROUNDDOWN(-3.14159, 1)', async () => {
    expect(await evaluate('=ROUNDDOWN(-3.14159, 1)')).toBeCloseTo(-3.1, 8);
  });
  it('=ROUNDDOWN(31415.92654, -2)', async () => {
    expect(await evaluate('=ROUNDDOWN(31415.92654, -2)')).toBeCloseTo(31400, 4);
  });
  it('=ROUNDDOWN(1234.5678, -1.5)', async () => {
    expect(await evaluate('=ROUNDDOWN(1234.5678, -1.5)')).toBeCloseTo(1230, 5);
  });
  it('=ROUNDDOWN("x", 1)', async () => {
    expect(await evaluate('=ROUNDDOWN("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
