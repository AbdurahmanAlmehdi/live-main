// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('XIRR', () => {
  it('=XIRR({-10000, 2750, 4250, 3250, 2750}, {39448, 39508, 39751, 39859, 39904}, 0.1)', async () => {
    expect(await evaluate('=XIRR({-10000, 2750, 4250, 3250, 2750}, {39448, 39508, 39751, 39859, 39904}, 0.1)')).toBeCloseTo(0.3733625335188317, 9);
  });
  it('=XIRR({-10000, 2750, 4250, 3250, 2750}, {39448, 39508, 39751, 39859, 39904})', async () => {
    expect(await evaluate('=XIRR({-10000, 2750, 4250, 3250, 2750}, {39448, 39508, 39751, 39859, 39904})')).toBeCloseTo(0.3733625335188317, 9);
  });
  it('=XIRR({-1000, 1100}, {40000, 40365})', async () => {
    expect(await evaluate('=XIRR({-1000, 1100}, {40000, 40365})')).toBeCloseTo(0.09999999999999988, 9);
  });
  it('=XIRR({-1000, 500, 300, 400}, {40000, 40200, 40400, 40800})', async () => {
    expect(await evaluate('=XIRR({-1000, 500, 300, 400}, {40000, 40200, 40400, 40800})')).toBeCloseTo(0.16483972860548993, 9);
  });
  it('=XIRR({1000, 1100}, {40000, 40365})', async () => {
    expect(await evaluate('=XIRR({1000, 1100}, {40000, 40365})')).toMatchObject({ code: '#NUM!' });
  });
  it('=XIRR({-1000, 1100}, {40000, 39000})', async () => {
    expect(await evaluate('=XIRR({-1000, 1100}, {40000, 39000})')).toMatchObject({ code: '#NUM!' });
  });
  it('=XIRR({-1000, 1100, 5}, {40000, 40365})', async () => {
    expect(await evaluate('=XIRR({-1000, 1100, 5}, {40000, 40365})')).toMatchObject({ code: '#NUM!' });
  });
});
