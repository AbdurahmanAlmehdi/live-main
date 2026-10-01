// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('VALUE', () => {
  it('=VALUE("$1,000")', async () => {
    expect(await evaluate('=VALUE("$1,000")')).toBeCloseTo(1000, 6);
  });
  it('=VALUE("16:48:00")', async () => {
    expect(await evaluate('=VALUE("16:48:00")')).toBeCloseTo(0.7, 9);
  });
  it('=VALUE("12.5%")', async () => {
    expect(await evaluate('=VALUE("12.5%")')).toBeCloseTo(0.125, 9);
  });
  it('=VALUE(" 42 ")', async () => {
    expect(await evaluate('=VALUE(" 42 ")')).toBeCloseTo(42, 7);
  });
  it('=VALUE(7)', async () => {
    expect(await evaluate('=VALUE(7)')).toBeCloseTo(7, 8);
  });
  it('=VALUE("2020-01-15")', async () => {
    expect(await evaluate('=VALUE("2020-01-15")')).toBeCloseTo(43845, 4);
  });
  it('=VALUE("abc")', async () => {
    expect(await evaluate('=VALUE("abc")')).toMatchObject({ code: '#VALUE!' });
  });
});
