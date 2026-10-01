// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('GAMMA', () => {
  it('=GAMMA(2.5)', async () => {
    expect(await evaluate('=GAMMA(2.5)')).toBeCloseTo(1.329340388179137, 8);
  });
  it('=GAMMA(5)', async () => {
    expect(await evaluate('=GAMMA(5)')).toBeCloseTo(24, 7);
  });
  it('=GAMMA(0.5)', async () => {
    expect(await evaluate('=GAMMA(0.5)')).toBeCloseTo(1.772453850905516, 8);
  });
  it('=GAMMA(-0.75)', async () => {
    expect(await evaluate('=GAMMA(-0.75)')).toBeCloseTo(-4.834146544295877, 8);
  });
  it('=GAMMA(1)', async () => {
    expect(await evaluate('=GAMMA(1)')).toBeCloseTo(1, 9);
  });
  it('=GAMMA(0)', async () => {
    expect(await evaluate('=GAMMA(0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMA(-2)', async () => {
    expect(await evaluate('=GAMMA(-2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMA(172)', async () => {
    expect(await evaluate('=GAMMA(172)')).toMatchObject({ code: '#NUM!' });
  });
  it('=GAMMA("x")', async () => {
    expect(await evaluate('=GAMMA("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
