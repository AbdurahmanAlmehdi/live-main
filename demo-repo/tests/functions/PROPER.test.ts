// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('PROPER', () => {
  it('=PROPER("this is a TITLE")', async () => {
    expect(await evaluate('=PROPER("this is a TITLE")')).toBe('This Is A Title');
  });
  it('=PROPER("2-way street")', async () => {
    expect(await evaluate('=PROPER("2-way street")')).toBe('2-Way Street');
  });
  it('=PROPER("76BudGet")', async () => {
    expect(await evaluate('=PROPER("76BudGet")')).toBe('76Budget');
  });
  it('=PROPER("o\'neil")', async () => {
    expect(await evaluate('=PROPER("o\'neil")')).toBe('O\'Neil');
  });
  it('=PROPER(#N/A)', async () => {
    expect(await evaluate('=PROPER(#N/A)')).toMatchObject({ code: '#N/A' });
  });
});
