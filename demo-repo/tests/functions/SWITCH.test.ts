// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SWITCH', () => {
  it('=SWITCH(2, 1, "one", 2, "two")', async () => {
    expect(await evaluate('=SWITCH(2, 1, "one", 2, "two")')).toBe('two');
  });
  it('=SWITCH(3, 1, "one", 2, "two", "other")', async () => {
    expect(await evaluate('=SWITCH(3, 1, "one", 2, "two", "other")')).toBe('other');
  });
  it('=SWITCH("b", "a", 1, "B", 2)', async () => {
    expect(await evaluate('=SWITCH("b", "a", 1, "B", 2)')).toBeCloseTo(2, 8);
  });
  it('=SWITCH(TRUE, FALSE, 0, TRUE, 1)', async () => {
    expect(await evaluate('=SWITCH(TRUE, FALSE, 0, TRUE, 1)')).toBeCloseTo(1, 9);
  });
  it('=SWITCH(9, 1, "one", 2, "two")', async () => {
    expect(await evaluate('=SWITCH(9, 1, "one", 2, "two")')).toMatchObject({ code: '#N/A' });
  });
  it('=SWITCH(#DIV/0!, 1, 2)', async () => {
    expect(await evaluate('=SWITCH(#DIV/0!, 1, 2)')).toMatchObject({ code: '#DIV/0!' });
  });
});
