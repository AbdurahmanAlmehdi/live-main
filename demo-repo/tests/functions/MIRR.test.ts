// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MIRR', () => {
  it('=MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.1, 0.12)', async () => {
    expect(await evaluate('=MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.1, 0.12)')).toBeCloseTo(0.1260941303659051, 9);
  });
  it('=MIRR({-120000, 39000, 30000, 21000}, 0.1, 0.12)', async () => {
    expect(await evaluate('=MIRR({-120000, 39000, 30000, 21000}, 0.1, 0.12)')).toBeCloseTo(-0.048044655249980806, 9);
  });
  it('=MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.1, 0.14)', async () => {
    expect(await evaluate('=MIRR({-120000, 39000, 30000, 21000, 37000, 46000}, 0.1, 0.14)')).toBeCloseTo(0.13475911082831482, 9);
  });
  it('=MIRR({-100, 50, "a", 60}, 0.05, 0.08)', async () => {
    expect(await evaluate('=MIRR({-100, 50, "a", 60}, 0.05, 0.08)')).toBeCloseTo(0.06770782520313112, 9);
  });
  it('=MIRR({100, 200}, 0.1, 0.1)', async () => {
    expect(await evaluate('=MIRR({100, 200}, 0.1, 0.1)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=MIRR({-100, -200}, 0.1, 0.1)', async () => {
    expect(await evaluate('=MIRR({-100, -200}, 0.1, 0.1)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=MIRR({-100, 50, 60}, "x", 0.1)', async () => {
    expect(await evaluate('=MIRR({-100, 50, 60}, "x", 0.1)')).toMatchObject({ code: '#VALUE!' });
  });
});
