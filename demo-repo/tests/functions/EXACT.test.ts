// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('EXACT', () => {
  it('=EXACT("word", "word")', async () => {
    expect(await evaluate('=EXACT("word", "word")')).toBe(true);
  });
  it('=EXACT("Word", "word")', async () => {
    expect(await evaluate('=EXACT("Word", "word")')).toBe(false);
  });
  it('=EXACT("w ord", "word")', async () => {
    expect(await evaluate('=EXACT("w ord", "word")')).toBe(false);
  });
  it('=EXACT(1, "1")', async () => {
    expect(await evaluate('=EXACT(1, "1")')).toBe(true);
  });
  it('=EXACT(#N/A, "x")', async () => {
    expect(await evaluate('=EXACT(#N/A, "x")')).toMatchObject({ code: '#N/A' });
  });
});
