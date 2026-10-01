// Expected values come from a reference spreadsheet implementation, reviewed against Excel.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/eval/evaluate';

describe('FISHER', () => {
  it('=FISHER(0.75)', async () => {
    expect(await evaluate('=FISHER(0.75)')).toBeCloseTo(0.9729550745276566, 9);
  });
  it('=FISHER(0)', async () => {
    expect(await evaluate('=FISHER(0)')).toBeCloseTo(0, 9);
  });
  it('=FISHER(-0.5)', async () => {
    expect(await evaluate('=FISHER(-0.5)')).toBeCloseTo(-0.5493061443340549, 9);
  });
  it('=FISHER(1)', async () => {
    expect(await evaluate('=FISHER(1)')).toMatchObject({ code: '#NUM!' });
  });
  it('=FISHER("x")', async () => {
    expect(await evaluate('=FISHER("x")')).toMatchObject({ code: '#VALUE!' });
  });
});
