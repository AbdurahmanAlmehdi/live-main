// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('XNPV', () => {
  it('=XNPV(0.09, {-10000, 2750, 4250, 3250, 2750}, {39448, 39508, 39751, 39859, 39904})', async () => {
    expect(await evaluate('=XNPV(0.09, {-10000, 2750, 4250, 3250, 2750}, {39448, 39508, 39751, 39859, 39904})')).toBeCloseTo(2086.647602031535, 5);
  });
  it('=XNPV(0, {-100, 50, 60}, {40000, 40100, 40200})', async () => {
    expect(await evaluate('=XNPV(0, {-100, 50, 60}, {40000, 40100, 40200})')).toBeCloseTo(10, 8);
  });
  it('=XNPV(0.1, {-1000, 1100}, {40000, 40365})', async () => {
    expect(await evaluate('=XNPV(0.1, {-1000, 1100}, {40000, 40365})')).toBeCloseTo(-1.1368683772161603e-13, 9);
  });
  it('=XNPV(0.05, {-1000, 300, 800}, {40000, 40180, 40500})', async () => {
    expect(await evaluate('=XNPV(0.05, {-1000, 300, 800}, {40000, 40180, 40500})')).toBeCloseTo(41.146863360190196, 7);
  });
  it('=XNPV(0.1, {-100, 50}, {40000, 39000})', async () => {
    expect(await evaluate('=XNPV(0.1, {-100, 50}, {40000, 39000})')).toMatchObject({ code: '#NUM!' });
  });
  it('=XNPV(0.1, {-100, 50, 60}, {40000, 40100})', async () => {
    expect(await evaluate('=XNPV(0.1, {-100, 50, 60}, {40000, 40100})')).toMatchObject({ code: '#NUM!' });
  });
  it('=XNPV("x", {-100, 50}, {40000, 40100})', async () => {
    expect(await evaluate('=XNPV("x", {-100, 50}, {40000, 40100})')).toMatchObject({ code: '#VALUE!' });
  });
});
