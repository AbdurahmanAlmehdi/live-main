// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('UNICHAR', () => {
  it('=UNICHAR(66)', async () => {
    expect(await evaluate('=UNICHAR(66)')).toBe('B');
  });
  it('=UNICHAR(32)', async () => {
    expect(await evaluate('=UNICHAR(32)')).toBe(' ');
  });
  it('=UNICHAR(8364)', async () => {
    expect(await evaluate('=UNICHAR(8364)')).toBe('€');
  });
  it('=UNICHAR(128512)', async () => {
    expect(await evaluate('=UNICHAR(128512)')).toBe('😀');
  });
  it('=UNICHAR(0)', async () => {
    expect(await evaluate('=UNICHAR(0)')).toMatchObject({ code: '#VALUE!' });
  });
  it('=UNICHAR("x")', async () => {
    expect(await evaluate('=UNICHAR("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
