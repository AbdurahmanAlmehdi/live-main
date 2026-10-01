// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ROMAN', () => {
  it('=ROMAN(499)', async () => {
    expect(await evaluate('=ROMAN(499)')).toBe('CDXCIX');
  });
  it('=ROMAN(1999)', async () => {
    expect(await evaluate('=ROMAN(1999)')).toBe('MCMXCIX');
  });
  it('=ROMAN(3999)', async () => {
    expect(await evaluate('=ROMAN(3999)')).toBe('MMMCMXCIX');
  });
  it('=ROMAN(4.9)', async () => {
    expect(await evaluate('=ROMAN(4.9)')).toBe('IV');
  });
  it('=ROMAN(0)', async () => {
    expect(await evaluate('=ROMAN(0)')).toBe('');
  });
  it('=ROMAN(4000)', async () => {
    expect(await evaluate('=ROMAN(4000)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=ROMAN(-1)', async () => {
    expect(await evaluate('=ROMAN(-1)')).toMatchObject({ code: '#VALUE!' });
  });
});
