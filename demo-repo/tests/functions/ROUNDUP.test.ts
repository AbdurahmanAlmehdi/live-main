// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ROUNDUP', () => {
  it('=ROUNDUP(3.2, 0)', async () => {
    expect(await evaluate('=ROUNDUP(3.2, 0)')).toBeCloseTo(4, 8);
  });
  it('=ROUNDUP(76.9, 0)', async () => {
    expect(await evaluate('=ROUNDUP(76.9, 0)')).toBeCloseTo(77, 7);
  });
  it('=ROUNDUP(3.14159, 3)', async () => {
    expect(await evaluate('=ROUNDUP(3.14159, 3)')).toBeCloseTo(3.142, 8);
  });
  it('=ROUNDUP(-3.14159, 1)', async () => {
    expect(await evaluate('=ROUNDUP(-3.14159, 1)')).toBeCloseTo(-3.2, 8);
  });
  it('=ROUNDUP(31415.92654, -2)', async () => {
    expect(await evaluate('=ROUNDUP(31415.92654, -2)')).toBeCloseTo(31500, 4);
  });
  it('=ROUNDUP(1234.5678, -1.5)', async () => {
    expect(await evaluate('=ROUNDUP(1234.5678, -1.5)')).toBeCloseTo(1240, 5);
  });
  it('=ROUNDUP("x", 1)', async () => {
    expect(await evaluate('=ROUNDUP("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
