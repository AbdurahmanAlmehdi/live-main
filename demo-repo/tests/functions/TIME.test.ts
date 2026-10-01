// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('TIME', () => {
  it('=TIME(12, 0, 0)', async () => {
    expect(await evaluate('=TIME(12, 0, 0)')).toBeCloseTo(0.5, 9);
  });
  it('=TIME(16, 48, 10)', async () => {
    expect(await evaluate('=TIME(16, 48, 10)')).toBeCloseTo(0.7001157407407408, 9);
  });
  it('=TIME(0, 90, 0)', async () => {
    expect(await evaluate('=TIME(0, 90, 0)')).toBeCloseTo(0.0625, 9);
  });
  it('=TIME(25, 0, 0)', async () => {
    expect(await evaluate('=TIME(25, 0, 0)')).toBeCloseTo(0.041666666666666664, 9);
  });
  it('=TIME(0, 0, -1)', async () => {
    expect(await evaluate('=TIME(0, 0, -1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=TIME(10.9, 30.5, 0)', async () => {
    expect(await evaluate('=TIME(10.9, 30.5, 0)')).toBeCloseTo(0.4375, 9);
  });
  it('=TIME("x", 0, 0)', async () => {
    expect(await evaluate('=TIME("x", 0, 0)')).toMatchObject({ code: '#VALUE!' });
  });
});
