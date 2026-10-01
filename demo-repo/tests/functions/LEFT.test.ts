// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('LEFT', () => {
  it('=LEFT("Sale Price", 4)', async () => {
    expect(await evaluate('=LEFT("Sale Price", 4)')).toBe('Sale');
  });
  it('=LEFT("Sweden")', async () => {
    expect(await evaluate('=LEFT("Sweden")')).toBe('S');
  });
  it('=LEFT("abc", 10)', async () => {
    expect(await evaluate('=LEFT("abc", 10)')).toBe('abc');
  });
  it('=LEFT("abc", 0)', async () => {
    expect(await evaluate('=LEFT("abc", 0)')).toBe('');
  });
  it('=LEFT(12345, 2)', async () => {
    expect(await evaluate('=LEFT(12345, 2)')).toBe('12');
  });
  it('=LEFT("abc", 1.9)', async () => {
    expect(await evaluate('=LEFT("abc", 1.9)')).toBe('a');
  });
  it('=LEFT("abc", -1)', async () => {
    expect(await evaluate('=LEFT("abc", -1)')).toMatchObject({ code: '#VALUE!' });
  });
});
