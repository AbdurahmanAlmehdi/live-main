// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FVSCHEDULE', () => {
  it('=FVSCHEDULE(1, {0.09, 0.11, 0.1})', async () => {
    expect(await evaluate('=FVSCHEDULE(1, {0.09, 0.11, 0.1})')).toBeCloseTo(1.3308900000000004, 8);
  });
  it('=FVSCHEDULE(1000, {0.05; 0.05; 0.05})', async () => {
    expect(await evaluate('=FVSCHEDULE(1000, {0.05; 0.05; 0.05})')).toBeCloseTo(1157.625, 5);
  });
  it('=FVSCHEDULE(100, 0.1)', async () => {
    expect(await evaluate('=FVSCHEDULE(100, 0.1)')).toBeCloseTo(110.00000000000001, 6);
  });
  it('=FVSCHEDULE(100, {0.1, -0.2})', async () => {
    expect(await evaluate('=FVSCHEDULE(100, {0.1, -0.2})')).toBeCloseTo(88.00000000000001, 7);
  });
  it('=FVSCHEDULE(100, {0.1, "x"})', async () => {
    expect(await evaluate('=FVSCHEDULE(100, {0.1, "x"})')).toMatchObject({ code: '#VALUE!' });
  });
  it('=FVSCHEDULE("x", {0.1})', async () => {
    expect(await evaluate('=FVSCHEDULE("x", {0.1})')).toMatchObject({ code: '#VALUE!' });
  });
});
