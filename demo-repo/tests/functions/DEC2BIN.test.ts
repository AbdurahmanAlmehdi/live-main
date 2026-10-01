// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('DEC2BIN', () => {
  it('=DEC2BIN(9, 4)', async () => {
    expect(await evaluate('=DEC2BIN(9, 4)')).toBe('1001');
  });
  it('=DEC2BIN(9)', async () => {
    expect(await evaluate('=DEC2BIN(9)')).toBe('1001');
  });
  it('=DEC2BIN(-100)', async () => {
    expect(await evaluate('=DEC2BIN(-100)')).toBe('1110011100');
  });
  it('=DEC2BIN(511)', async () => {
    expect(await evaluate('=DEC2BIN(511)')).toBe('111111111');
  });
  it('=DEC2BIN(9.7)', async () => {
    expect(await evaluate('=DEC2BIN(9.7)')).toBe('1001');
  });
  it('=DEC2BIN("12")', async () => {
    expect(await evaluate('=DEC2BIN("12")')).toBe('1100');
  });
  it('=DEC2BIN(0)', async () => {
    expect(await evaluate('=DEC2BIN(0)')).toBe('0');
  });
  it('=DEC2BIN(-1, 3)', async () => {
    expect(await evaluate('=DEC2BIN(-1, 3)')).toBe('1111111111');
  });
  it('=DEC2BIN(512)', async () => {
    expect(await evaluate('=DEC2BIN(512)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2BIN(-513)', async () => {
    expect(await evaluate('=DEC2BIN(-513)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2BIN(9, 2)', async () => {
    expect(await evaluate('=DEC2BIN(9, 2)')).toMatchObject({ code: '#NUM!' });
  });
  it('=DEC2BIN("x")', async () => {
    expect(await evaluate('=DEC2BIN("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
