// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ERFC', () => {
  it('=ERFC(1)', async () => {
    expect(await evaluate('=ERFC(1)')).toBeCloseTo(0.1572992070502851, 9);
  });
  it('=ERFC(0)', async () => {
    expect(await evaluate('=ERFC(0)')).toBeCloseTo(1, 9);
  });
  it('=ERFC(-1)', async () => {
    expect(await evaluate('=ERFC(-1)')).toBeCloseTo(1.842700792949715, 8);
  });
  it('=ERFC(0.5)', async () => {
    expect(await evaluate('=ERFC(0.5)')).toBeCloseTo(0.4795001221869535, 9);
  });
  it('=ERFC(5)', async () => {
    expect(await evaluate('=ERFC(5)')).toBeCloseTo(1.5374368445009168e-12, 9);
  });
  it('=ERFC("x")', async () => {
    expect(await evaluate('=ERFC("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
