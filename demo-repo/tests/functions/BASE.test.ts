// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('BASE', () => {
  it('=BASE(7, 2)', async () => {
    expect(await evaluate('=BASE(7, 2)')).toBe('111');
  });
  it('=BASE(100, 16)', async () => {
    expect(await evaluate('=BASE(100, 16)')).toBe('64');
  });
  it('=BASE(15, 2, 10)', async () => {
    expect(await evaluate('=BASE(15, 2, 10)')).toBe('0000001111');
  });
  it('=BASE(1000, 2)', async () => {
    expect(await evaluate('=BASE(1000, 2)')).toBe('1111101000');
  });
  it('=BASE(12345, 36)', async () => {
    expect(await evaluate('=BASE(12345, 36)')).toBe('9IX');
  });
  it('=BASE(255, 16, 1)', async () => {
    expect(await evaluate('=BASE(255, 16, 1)')).toBe('FF');
  });
  it('=BASE(-1, 2)', async () => {
    expect(await evaluate('=BASE(-1, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=BASE(10, 1)', async () => {
    expect(await evaluate('=BASE(10, 1)')).toMatchObject({ code: '#NUM!' });
  });
});
