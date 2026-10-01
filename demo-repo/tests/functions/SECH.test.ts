// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('SECH', () => {
  it('=SECH(45)', async () => {
    expect(await evaluate('=SECH(45)')).toBeCloseTo(5.725037161098787e-20, 9);
  });
  it('=SECH(0)', async () => {
    expect(await evaluate('=SECH(0)')).toBeCloseTo(1, 9);
  });
  it('=SECH(-1)', async () => {
    expect(await evaluate('=SECH(-1)')).toBeCloseTo(0.6480542736638855, 9);
  });
  it('=SECH(0.5)', async () => {
    expect(await evaluate('=SECH(0.5)')).toBeCloseTo(0.886818883970074, 9);
  });
  it('=SECH("x")', async () => {
    expect(await evaluate('=SECH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
