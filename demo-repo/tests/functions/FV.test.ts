// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FV', () => {
  it('=FV(0.06/12, 10, -200, -500, 1)', async () => {
    expect(await evaluate('=FV(0.06/12, 10, -200, -500, 1)')).toBeCloseTo(2581.4033740601362, 5);
  });
  it('=FV(0.12/12, 12, -1000)', async () => {
    expect(await evaluate('=FV(0.12/12, 12, -1000)')).toBeCloseTo(12682.503013196976, 4);
  });
  it('=FV(0.11/12, 35, -2000, , 1)', async () => {
    expect(await evaluate('=FV(0.11/12, 35, -2000, , 1)')).toBeCloseTo(82846.24637190053, 4);
  });
  it('=FV(0, 10, -100, -1000)', async () => {
    expect(await evaluate('=FV(0, 10, -100, -1000)')).toBeCloseTo(2000, 5);
  });
  it('=FV(0.05, 10, 0, -1000)', async () => {
    expect(await evaluate('=FV(0.05, 10, 0, -1000)')).toBeCloseTo(1628.8946267774422, 5);
  });
  it('=FV(-0.02, 5, -100, 1000)', async () => {
    expect(await evaluate('=FV(-0.02, 5, -100, 1000)')).toBeCloseTo(-423.52478079999963, 6);
  });
  it('=FV(0.1, 2.5, -100)', async () => {
    expect(await evaluate('=FV(0.1, 2.5, -100)')).toBeCloseTo(269.05870628588355, 6);
  });
  it('=FV("1%", 12, -100)', async () => {
    expect(await evaluate('=FV("1%", 12, -100)')).toBeCloseTo(1268.2503013196979, 5);
  });
  it('=FV("x", 12, -100)', async () => {
    expect(await evaluate('=FV("x", 12, -100)')).toMatchObject({ code: '#VALUE!' });
  });
});
