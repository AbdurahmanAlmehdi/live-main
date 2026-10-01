// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('RRI', () => {
  it('=RRI(96, 10000, 11000)', async () => {
    expect(await evaluate('=RRI(96, 10000, 11000)')).toBeCloseTo(0.0009933073762913303, 9);
  });
  it('=RRI(10, 100, 200)', async () => {
    expect(await evaluate('=RRI(10, 100, 200)')).toBeCloseTo(0.07177346253629313, 9);
  });
  it('=RRI(2, 100, 50)', async () => {
    expect(await evaluate('=RRI(2, 100, 50)')).toBeCloseTo(-0.2928932188134524, 9);
  });
  it('=RRI(0, 100, 200)', async () => {
    expect(await evaluate('=RRI(0, 100, 200)')).toMatchObject({ code: '#NUM!' });
  });
  it('=RRI(10, 0, 100)', async () => {
    expect(await evaluate('=RRI(10, 0, 100)')).toMatchObject({ code: '#NUM!' });
  });
  it('=RRI("x", 100, 200)', async () => {
    expect(await evaluate('=RRI("x", 100, 200)')).toMatchObject({ code: '#VALUE!' });
  });
});
