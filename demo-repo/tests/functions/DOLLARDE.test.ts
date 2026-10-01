// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DOLLARDE', () => {
  it('=DOLLARDE(1.02, 16)', async () => {
    expect(await evaluate('=DOLLARDE(1.02, 16)')).toBeCloseTo(1.125, 8);
  });
  it('=DOLLARDE(1.1, 32)', async () => {
    expect(await evaluate('=DOLLARDE(1.1, 32)')).toBeCloseTo(1.3125, 8);
  });
  it('=DOLLARDE(-1.02, 16)', async () => {
    expect(await evaluate('=DOLLARDE(-1.02, 16)')).toBeCloseTo(-1.125, 8);
  });
  it('=DOLLARDE(1.1, 8)', async () => {
    expect(await evaluate('=DOLLARDE(1.1, 8)')).toBeCloseTo(1.125, 8);
  });
  it('=DOLLARDE(1.5, 10)', async () => {
    expect(await evaluate('=DOLLARDE(1.5, 10)')).toBeCloseTo(1.5, 8);
  });
  it('=DOLLARDE(1.02, 16.9)', async () => {
    expect(await evaluate('=DOLLARDE(1.02, 16.9)')).toBeCloseTo(1.125, 8);
  });
  it('=DOLLARDE(1.02, 0)', async () => {
    expect(await evaluate('=DOLLARDE(1.02, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=DOLLARDE(1.02, -1)', async () => {
    expect(await evaluate('=DOLLARDE(1.02, -1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DOLLARDE("x", 16)', async () => {
    expect(await evaluate('=DOLLARDE("x", 16)')).toMatchObject({ code: '#VALUE!' });
  });
});
