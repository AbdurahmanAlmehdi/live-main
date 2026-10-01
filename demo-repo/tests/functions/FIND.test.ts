// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FIND', () => {
  it('=FIND("M", "Miriam McGovern")', async () => {
    expect(await evaluate('=FIND("M", "Miriam McGovern")')).toBeCloseTo(1, 9);
  });
  it('=FIND("m", "Miriam McGovern")', async () => {
    expect(await evaluate('=FIND("m", "Miriam McGovern")')).toBeCloseTo(6, 8);
  });
  it('=FIND("M", "Miriam McGovern", 3)', async () => {
    expect(await evaluate('=FIND("M", "Miriam McGovern", 3)')).toBeCloseTo(8, 8);
  });
  it('=FIND("", "abc")', async () => {
    expect(await evaluate('=FIND("", "abc")')).toBeCloseTo(1, 9);
  });
  it('=FIND("z", "abc")', async () => {
    expect(await evaluate('=FIND("z", "abc")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=FIND("a", "abc", 0)', async () => {
    expect(await evaluate('=FIND("a", "abc", 0)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=FIND("a", "abc", 9)', async () => {
    expect(await evaluate('=FIND("a", "abc", 9)')).toMatchObject({ code: '#VALUE!' });
  });
});
