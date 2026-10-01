// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LOG', () => {
  it('=LOG(10)', async () => {
    expect(await evaluate('=LOG(10)')).toBeCloseTo(1, 9);
  });
  it('=LOG(8, 2)', async () => {
    expect(await evaluate('=LOG(8, 2)')).toBeCloseTo(3, 8);
  });
  it('=LOG(86, 2.7182818)', async () => {
    expect(await evaluate('=LOG(86, 2.7182818)')).toBeCloseTo(4.454347342888287, 8);
  });
  it('=LOG(0.5, 4)', async () => {
    expect(await evaluate('=LOG(0.5, 4)')).toBeCloseTo(-0.5, 9);
  });
  it('=LOG(0)', async () => {
    expect(await evaluate('=LOG(0)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LOG(10, 1)', async () => {
    expect(await evaluate('=LOG(10, 1)')).toMatchObject({ code: '#DIV/0!' });
  });
  it('=LOG(10, -2)', async () => {
    expect(await evaluate('=LOG(10, -2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=LOG("x")', async () => {
    expect(await evaluate('=LOG("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
