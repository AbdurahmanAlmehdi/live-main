// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('ACOTH', () => {
  it('=ACOTH(6)', async () => {
    expect(await evaluate('=ACOTH(6)')).toBeCloseTo(0.16823611831060642, 9);
  });
  it('=ACOTH(-2)', async () => {
    expect(await evaluate('=ACOTH(-2)')).toBeCloseTo(-0.5493061443340549, 9);
  });
  it('=ACOTH(1.5)', async () => {
    expect(await evaluate('=ACOTH(1.5)')).toBeCloseTo(0.8047189562170501, 9);
  });
  it('=ACOTH(0.5)', async () => {
    expect(await evaluate('=ACOTH(0.5)')).toMatchObject({ code: '#NUM!' });
  });
  it('=ACOTH("x")', async () => {
    expect(await evaluate('=ACOTH("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
