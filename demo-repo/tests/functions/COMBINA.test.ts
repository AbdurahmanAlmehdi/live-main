// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COMBINA', () => {
  it('=COMBINA(4, 3)', async () => {
    expect(await evaluate('=COMBINA(4, 3)')).toBeCloseTo(20, 7);
  });
  it('=COMBINA(10, 3)', async () => {
    expect(await evaluate('=COMBINA(10, 3)')).toBeCloseTo(220, 6);
  });
  it('=COMBINA(0, 0)', async () => {
    expect(await evaluate('=COMBINA(0, 0)')).toBeCloseTo(1, 9);
  });
  it('=COMBINA(3, 0)', async () => {
    expect(await evaluate('=COMBINA(3, 0)')).toBeCloseTo(1, 9);
  });
  it('=COMBINA(-1, 2)', async () => {
    expect(await evaluate('=COMBINA(-1, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=COMBINA("x", 1)', async () => {
    expect(await evaluate('=COMBINA("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
