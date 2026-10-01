// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PV', () => {
  it('=PV(0.08/12, 12*20, 500, , 0)', async () => {
    expect(await evaluate('=PV(0.08/12, 12*20, 500, , 0)')).toBeCloseTo(-59777.14585118777, 4);
  });
  it('=PV(0.1, 5, -100, -1000, 1)', async () => {
    expect(await evaluate('=PV(0.1, 5, -100, -1000, 1)')).toBeCloseTo(1037.9078676940844, 5);
  });
  it('=PV(0, 10, -100)', async () => {
    expect(await evaluate('=PV(0, 10, -100)')).toBeCloseTo(1000, 6);
  });
  it('=PV(0.05, 10, 0, 1000)', async () => {
    expect(await evaluate('=PV(0.05, 10, 0, 1000)')).toBeCloseTo(-613.9132535407591, 6);
  });
  it('=PV(0.07, 3.5, -250)', async () => {
    expect(await evaluate('=PV(0.07, 3.5, -250)')).toBeCloseTo(753.0537731396735, 6);
  });
  it('=PV(0.05, "10", -100)', async () => {
    expect(await evaluate('=PV(0.05, "10", -100)')).toBeCloseTo(772.1734929184819, 6);
  });
  it('=PV("x", 10, 100)', async () => {
    expect(await evaluate('=PV("x", 10, 100)')).toMatchObject({ code: '#VALUE!' });
  });
});
