// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SLN', () => {
  it('=SLN(30000, 7500, 10)', async () => {
    expect(await evaluate('=SLN(30000, 7500, 10)')).toBeCloseTo(2250, 5);
  });
  it('=SLN(10000, 1000, 2.5)', async () => {
    expect(await evaluate('=SLN(10000, 1000, 2.5)')).toBeCloseTo(3600, 5);
  });
  it('=SLN(1000, 2000, 5)', async () => {
    expect(await evaluate('=SLN(1000, 2000, 5)')).toBeCloseTo(-200, 6);
  });
  it('=SLN(1000, 100, 0)', async () => {
    expect(await evaluate('=SLN(1000, 100, 0)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=SLN("x", 1, 2)', async () => {
    expect(await evaluate('=SLN("x", 1, 2)')).toMatchObject({ code: '#VALUE!' });
  });
});
