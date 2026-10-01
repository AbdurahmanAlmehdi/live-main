// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('HOUR', () => {
  it('=HOUR(0.75)', async () => {
    expect(await evaluate('=HOUR(0.75)')).toBeCloseTo(18, 7);
  });
  it('=HOUR(43845.5)', async () => {
    expect(await evaluate('=HOUR(43845.5)')).toBeCloseTo(12, 7);
  });
  it('=HOUR(0.99999)', async () => {
    expect(await evaluate('=HOUR(0.99999)')).toBeCloseTo(23, 7);
  });
  it('=HOUR(0)', async () => {
    expect(await evaluate('=HOUR(0)')).toBeCloseTo(0, 9);
  });
  it('=HOUR(-1)', async () => {
    expect(await evaluate('=HOUR(-1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=HOUR("x")', async () => {
    expect(await evaluate('=HOUR("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
