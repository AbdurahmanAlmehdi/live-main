// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('CHAR', () => {
  it('=CHAR(65)', async () => {
    expect(await evaluate('=CHAR(65)')).toBe('A');
  });
  it('=CHAR(97)', async () => {
    expect(await evaluate('=CHAR(97)')).toBe('a');
  });
  it('=CHAR(33)', async () => {
    expect(await evaluate('=CHAR(33)')).toBe('!');
  });
  it('=CHAR(65.9)', async () => {
    expect(await evaluate('=CHAR(65.9)')).toBe('A');
  });
  it('=CHAR(0)', async () => {
    expect(await evaluate('=CHAR(0)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=CHAR(256)', async () => {
    expect(await evaluate('=CHAR(256)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=CHAR("x")', async () => {
    expect(await evaluate('=CHAR("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
