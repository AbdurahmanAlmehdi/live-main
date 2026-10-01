// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('NOT', () => {
  it('=NOT(TRUE)', async () => {
    expect(await evaluate('=NOT(TRUE)')).toBe(false);
  });
  it('=NOT(FALSE)', async () => {
    expect(await evaluate('=NOT(FALSE)')).toBe(true);
  });
  it('=NOT(0)', async () => {
    expect(await evaluate('=NOT(0)')).toBe(true);
  });
  it('=NOT(5)', async () => {
    expect(await evaluate('=NOT(5)')).toBe(false);
  });
  it('=NOT("x")', async () => {
    expect(await evaluate('=NOT("x")')).toMatchObject({ code: '#VALUE!' });
  });
  it('=NOT(#N/A)', async () => {
    expect(await evaluate('=NOT(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
