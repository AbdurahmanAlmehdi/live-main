// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SYD', () => {
  it('=SYD(30000, 7500, 10, 1)', async () => {
    expect(await evaluate('=SYD(30000, 7500, 10, 1)')).toBeCloseTo(4090.909090909091, 5);
  });
  it('=SYD(30000, 7500, 10, 10)', async () => {
    expect(await evaluate('=SYD(30000, 7500, 10, 10)')).toBeCloseTo(409.09090909090907, 6);
  });
  it('=SYD(1000, 100, 5, 3)', async () => {
    expect(await evaluate('=SYD(1000, 100, 5, 3)')).toBeCloseTo(180, 6);
  });
  it('=SYD(1000, 100, 5, 0)', async () => {
    expect(await evaluate('=SYD(1000, 100, 5, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SYD(1000, 100, 5, 6)', async () => {
    expect(await evaluate('=SYD(1000, 100, 5, 6)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SYD(1000, 100, 0, 1)', async () => {
    expect(await evaluate('=SYD(1000, 100, 0, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=SYD("x", 100, 5, 1)', async () => {
    expect(await evaluate('=SYD("x", 100, 5, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
