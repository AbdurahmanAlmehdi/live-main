// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('MID', () => {
  it('=MID("Fluid Flow", 1, 5)', async () => {
    expect(await evaluate('=MID("Fluid Flow", 1, 5)')).toBe('Fluid');
  });
  it('=MID("Fluid Flow", 7, 20)', async () => {
    expect(await evaluate('=MID("Fluid Flow", 7, 20)')).toBe('Flow');
  });
  it('=MID("Fluid Flow", 20, 5)', async () => {
    expect(await evaluate('=MID("Fluid Flow", 20, 5)')).toBe('');
  });
  it('=MID("abc", 2, 0)', async () => {
    expect(await evaluate('=MID("abc", 2, 0)')).toBe('');
  });
  it('=MID(12345, 2, 3)', async () => {
    expect(await evaluate('=MID(12345, 2, 3)')).toBe('234');
  });
  it('=MID("abc", 0, 1)', async () => {
    expect(await evaluate('=MID("abc", 0, 1)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=MID("abc", 1, -1)', async () => {
    expect(await evaluate('=MID("abc", 1, -1)')).toMatchObject({ code: '#VALUE!' });
  });
});
