// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BITRSHIFT', () => {
  it('=BITRSHIFT(13, 2)', async () => {
    expect(await evaluate('=BITRSHIFT(13, 2)')).toBeCloseTo(3, 8);
  });
  it('=BITRSHIFT(4, -2)', async () => {
    expect(await evaluate('=BITRSHIFT(4, -2)')).toBeCloseTo(16, 7);
  });
  it('=BITRSHIFT(281474976710655, 47)', async () => {
    expect(await evaluate('=BITRSHIFT(281474976710655, 47)')).toBeCloseTo(1, 9);
  });
  it('=BITRSHIFT(1, 5)', async () => {
    expect(await evaluate('=BITRSHIFT(1, 5)')).toBeCloseTo(0, 9);
  });
  it('=BITRSHIFT(1, -48)', async () => {
    expect(await evaluate('=BITRSHIFT(1, -48)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITRSHIFT(1, 54)', async () => {
    expect(await evaluate('=BITRSHIFT(1, 54)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITRSHIFT(1.5, 1)', async () => {
    expect(await evaluate('=BITRSHIFT(1.5, 1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BITRSHIFT("x", 1)', async () => {
    expect(await evaluate('=BITRSHIFT("x", 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
