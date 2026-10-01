// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('IFS', () => {
  it('=IFS(FALSE, 1, TRUE, 2)', async () => {
    expect(await evaluate('=IFS(FALSE, 1, TRUE, 2)')).toBeCloseTo(2, 8);
  });
  it('=IFS(TRUE, "first", TRUE, "second")', async () => {
    expect(await evaluate('=IFS(TRUE, "first", TRUE, "second")')).toBe('first');
  });
  it('=IFS(1 > 2, "a", 2 > 1, "b")', async () => {
    expect(await evaluate('=IFS(1 > 2, "a", 2 > 1, "b")')).toBe('b');
  });
  it('=IFS(0, 1, 5, 2)', async () => {
    expect(await evaluate('=IFS(0, 1, 5, 2)')).toBeCloseTo(2, 8);
  });
  it('=IFS(FALSE, 1, FALSE, 2)', async () => {
    expect(await evaluate('=IFS(FALSE, 1, FALSE, 2)')).toMatchObject({ code: '#N/A' });
  });
  it('=IFS(#VALUE!, 1)', async () => {
    expect(await evaluate('=IFS(#VALUE!, 1)')).toMatchObject({ code: '#VALUE!' });
  });
});
