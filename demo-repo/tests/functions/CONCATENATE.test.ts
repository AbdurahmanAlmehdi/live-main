// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CONCATENATE', () => {
  it('=CONCATENATE("Stream ", "population")', async () => {
    expect(await evaluate('=CONCATENATE("Stream ", "population")')).toBe('Stream population');
  });
  it('=CONCATENATE(1, 2, 3)', async () => {
    expect(await evaluate('=CONCATENATE(1, 2, 3)')).toBe('123');
  });
  it('=CONCATENATE("a", TRUE)', async () => {
    expect(await evaluate('=CONCATENATE("a", TRUE)')).toBe('aTRUE');
  });
  it('=CONCATENATE("x")', async () => {
    expect(await evaluate('=CONCATENATE("x")')).toBe('x');
  });
  it('=CONCATENATE("a", 1/0)', async () => {
    expect(await evaluate('=CONCATENATE("a", 1/0)')).toMatchObject({ code: '#DIV/0!' });
  });
});
