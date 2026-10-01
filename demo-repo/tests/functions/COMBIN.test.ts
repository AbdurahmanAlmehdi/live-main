// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('COMBIN', () => {
  it('=COMBIN(8, 2)', async () => {
    expect(await evaluate('=COMBIN(8, 2)')).toBeCloseTo(28, 7);
  });
  it('=COMBIN(10, 0)', async () => {
    expect(await evaluate('=COMBIN(10, 0)')).toBeCloseTo(1, 9);
  });
  it('=COMBIN(52, 5)', async () => {
    expect(await evaluate('=COMBIN(52, 5)')).toBeCloseTo(2598960, 2);
  });
  it('=COMBIN(8.9, 2.7)', async () => {
    expect(await evaluate('=COMBIN(8.9, 2.7)')).toBeCloseTo(28, 7);
  });
  it('=COMBIN(2, 3)', async () => {
    expect(await evaluate('=COMBIN(2, 3)')).toMatchObject({ code: '#NUM!' });
  });
  it('=COMBIN(-1, 0)', async () => {
    expect(await evaluate('=COMBIN(-1, 0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=COMBIN("x", 1)', async () => {
    expect(await evaluate('=COMBIN("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
